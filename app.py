import io
import os
import re
import sqlite3
from datetime import datetime

from flask import Flask, request, jsonify, g, send_file, send_from_directory
from prometheus_flask_exporter import PrometheusMetrics

from report_pdf import build_report_pdf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# A React production build (if present in ./static) is served by Flask.
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="")
PrometheusMetrics(app)  # exposes /metrics for Prometheus

DB_PATH = os.getenv("DB_PATH", os.path.join(BASE_DIR, "data", "spms.db"))

# Students count as "at risk" when they fall below either target.
RISK_SCORE = 50
RISK_ATTENDANCE = 75

GRADE_CUTOFFS = [(90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D")]
GRADE_ORDER = ["A+", "A", "B", "C", "D", "F"]

# Normalized schema: subjects live in their own table, marks reference them,
# and indexes cover the columns we filter and group by.
SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    course TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    score REAL NOT NULL CHECK (score BETWEEN 0 AND 100),
    UNIQUE (student_id, subject_id)
);
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    present INTEGER NOT NULL CHECK (present IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
"""


def init_db(path=None):
    """Create the schema, and upgrade an older database in place (keeps your data)."""
    path = path or DB_PATH
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("PRAGMA foreign_keys = OFF")

    # Older versions stored the subject name as text inside marks.
    cols = [r[1] for r in con.execute("PRAGMA table_info(marks)")]
    legacy = bool(cols) and "subject_id" not in cols
    if legacy:
        con.execute("ALTER TABLE marks RENAME TO marks_old")

    con.executescript(SCHEMA)

    if legacy:
        con.execute("INSERT OR IGNORE INTO subjects (name) SELECT DISTINCT TRIM(subject) FROM marks_old")
        con.execute(
            "INSERT OR REPLACE INTO marks (student_id, subject_id, score) "
            "SELECT o.student_id, s.id, o.score FROM marks_old o "
            "JOIN subjects s ON s.name = TRIM(o.subject) ORDER BY o.id"
        )
        con.execute("DROP TABLE marks_old")

    # One attendance entry per student per day.
    con.execute(
        "DELETE FROM attendance WHERE id NOT IN "
        "(SELECT MAX(id) FROM attendance GROUP BY student_id, date)"
    )
    con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date)")
    con.commit()
    con.close()


init_db()


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def grade(avg):
    if avg is None:
        return "-"
    for cutoff, letter in GRADE_CUTOFFS:
        if avg >= cutoff:
            return letter
    return "F"


def risk_reasons(avg, attendance):
    reasons = []
    if avg is not None and avg < RISK_SCORE:
        reasons.append(f"Average score is below {RISK_SCORE}")
    if attendance is not None and attendance < RISK_ATTENDANCE:
        reasons.append(f"Attendance is below {RISK_ATTENDANCE}%")
    return reasons


def student_rows(db):
    rows = db.execute(
        """
        SELECT s.*,
          ROUND((SELECT AVG(score) FROM marks WHERE student_id = s.id), 1) AS average,
          ROUND((SELECT AVG(present) * 100 FROM attendance WHERE student_id = s.id), 1) AS attendance
        FROM students s ORDER BY s.roll_no
        """
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["grade"] = grade(d["average"])
        d["risk_reasons"] = risk_reasons(d["average"], d["attendance"])
        d["at_risk"] = bool(d["risk_reasons"])
        out.append(d)
    return out


def build_report(db, sid):
    s = db.execute("SELECT * FROM students WHERE id = ?", (sid,)).fetchone()
    if s is None:
        return None
    marks = db.execute(
        "SELECT sub.name AS subject, m.score FROM marks m "
        "JOIN subjects sub ON sub.id = m.subject_id WHERE m.student_id = ? ORDER BY sub.name",
        (sid,),
    ).fetchall()
    att = db.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(present), 0) AS present "
        "FROM attendance WHERE student_id = ?",
        (sid,),
    ).fetchone()
    avg = sum(m["score"] for m in marks) / len(marks) if marks else None
    pct = 100 * att["present"] / att["total"] if att["total"] else None
    reasons = risk_reasons(avg, pct)
    return {
        "name": s["name"],
        "roll_no": s["roll_no"],
        "course": s["course"],
        "average": round(avg, 2) if avg is not None else 0,
        "grade": grade(avg),
        "attendance_percent": round(pct, 1) if pct is not None else 0,
        "days_recorded": att["total"],
        "subjects": {m["subject"]: m["score"] for m in marks},
        "at_risk": bool(reasons),
        "risk_reasons": reasons,
    }


@app.get("/")
def home():
    if os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return {"message": "SPMS API is running."}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/students")
def list_students():
    return jsonify(student_rows(get_db()))


@app.post("/api/students")
def add_student():
    d = request.get_json(force=True)
    if not all(str(d.get(k, "")).strip() for k in ("roll_no", "name", "course")):
        return {"error": "Roll number, name and course are required"}, 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO students (roll_no, name, course) VALUES (?, ?, ?)",
            (d["roll_no"].strip(), d["name"].strip(), d["course"].strip()),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return {"error": "That roll number already exists"}, 409
    return {"id": cur.lastrowid}, 201


@app.delete("/api/students/<int:sid>")
def delete_student(sid):
    db = get_db()
    db.execute("DELETE FROM students WHERE id = ?", (sid,))
    db.commit()
    return "", 204


@app.put("/api/students/<int:sid>")
def update_student(sid):
    d = request.get_json(force=True)
    fields = {k: str(d.get(k, "")).strip() for k in ("roll_no", "name", "course")}
    if not all(fields.values()):
        return {"error": "Roll number, name and course are required"}, 400
    db = get_db()
    if db.execute("SELECT 1 FROM students WHERE id = ?", (sid,)).fetchone() is None:
        return {"error": "Student not found"}, 404
    try:
        db.execute(
            "UPDATE students SET roll_no = ?, name = ?, course = ? WHERE id = ?",
            (fields["roll_no"], fields["name"], fields["course"], sid),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return {"error": "That roll number already exists"}, 409
    return {"id": sid}


@app.get("/api/subjects")
def list_subjects():
    rows = get_db().execute("SELECT name FROM subjects ORDER BY name").fetchall()
    return jsonify([r["name"] for r in rows])


@app.post("/api/marks")
def add_mark():
    d = request.get_json(force=True)
    try:
        score = float(d["score"])
        subject = " ".join(str(d["subject"]).split())
        if not subject or not 0 <= score <= 100:
            raise ValueError
        db = get_db()
        db.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (subject,))
        subject_id = db.execute("SELECT id FROM subjects WHERE name = ?", (subject,)).fetchone()["id"]
        # Entering a subject again for the same student updates the score.
        db.execute(
            "INSERT INTO marks (student_id, subject_id, score) VALUES (?, ?, ?) "
            "ON CONFLICT(student_id, subject_id) DO UPDATE SET score = excluded.score",
            (d["student_id"], subject_id, score),
        )
        db.commit()
    except (KeyError, ValueError, TypeError, sqlite3.IntegrityError):
        return {"error": "Choose a student, enter a subject and a score from 0 to 100"}, 400
    return {"status": "saved"}, 201


@app.get("/api/students/<int:sid>/marks")
def student_marks(sid):
    rows = get_db().execute(
        "SELECT m.id, sub.name AS subject, m.score FROM marks m "
        "JOIN subjects sub ON sub.id = m.subject_id WHERE m.student_id = ? ORDER BY sub.name",
        (sid,),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.put("/api/marks/<int:mid>")
def update_mark(mid):
    d = request.get_json(force=True)
    try:
        score = float(d["score"])
        if not 0 <= score <= 100:
            raise ValueError
    except (KeyError, ValueError, TypeError):
        return {"error": "Score must be a number from 0 to 100"}, 400
    db = get_db()
    cur = db.execute("UPDATE marks SET score = ? WHERE id = ?", (score, mid))
    db.commit()
    if cur.rowcount == 0:
        return {"error": "Marks entry not found"}, 404
    return {"id": mid}


@app.delete("/api/marks/<int:mid>")
def delete_mark(mid):
    db = get_db()
    cur = db.execute("DELETE FROM marks WHERE id = ?", (mid,))
    db.commit()
    if cur.rowcount == 0:
        return {"error": "Marks entry not found"}, 404
    return "", 204


@app.post("/api/attendance")
def add_attendance():
    d = request.get_json(force=True)
    try:
        datetime.strptime(str(d["date"]), "%Y-%m-%d")
        db = get_db()
        db.execute(
            "INSERT INTO attendance (student_id, date, present) VALUES (?, ?, ?) "
            "ON CONFLICT(student_id, date) DO UPDATE SET present = excluded.present",
            (d["student_id"], d["date"], 1 if d["present"] else 0),
        )
        db.commit()
    except (KeyError, ValueError, TypeError, sqlite3.IntegrityError):
        return {"error": "Choose a student and a valid date"}, 400
    return {"status": "saved"}, 201


def _valid_day(value):
    try:
        datetime.strptime(str(value), "%Y-%m-%d")
        return True
    except ValueError:
        return False


@app.get("/api/attendance")
def attendance_for_day():
    day = request.args.get("date", "")
    if not _valid_day(day):
        return {"error": "Choose a valid date"}, 400
    rows = get_db().execute(
        "SELECT student_id, present FROM attendance WHERE date = ?", (day,)
    ).fetchall()
    return jsonify([{"student_id": r["student_id"], "present": bool(r["present"])} for r in rows])


@app.post("/api/attendance/bulk")
def attendance_bulk():
    """Save a whole class for one day in a single all-or-nothing request."""
    d = request.get_json(force=True)
    db = get_db()
    try:
        day = d["date"]
        records = d["records"]
        if not _valid_day(day) or not isinstance(records, list) or not records:
            raise ValueError
        db.executemany(
            "INSERT INTO attendance (student_id, date, present) VALUES (?, ?, ?) "
            "ON CONFLICT(student_id, date) DO UPDATE SET present = excluded.present",
            [(r["student_id"], day, 1 if r["present"] else 0) for r in records],
        )
        db.commit()
    except (KeyError, ValueError, TypeError, sqlite3.IntegrityError):
        db.rollback()
        return {"error": "Choose a valid date and at least one existing student"}, 400
    return {"saved": len(records)}, 201


@app.get("/api/students/<int:sid>/report")
def report(sid):
    data = build_report(get_db(), sid)
    if data is None:
        return {"error": "Student not found"}, 404
    return data


@app.get("/api/students/<int:sid>/report.pdf")
def report_pdf(sid):
    data = build_report(get_db(), sid)
    if data is None:
        return {"error": "Student not found"}, 404
    safe_roll = re.sub(r"[^A-Za-z0-9_-]", "_", data["roll_no"])
    return send_file(
        io.BytesIO(build_report_pdf(data)),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"report-{safe_roll}.pdf",
    )


@app.get("/api/summary")
def summary():
    db = get_db()
    students = student_rows(db)
    avg = db.execute("SELECT AVG(score) FROM marks").fetchone()[0] or 0
    att = db.execute("SELECT AVG(present) * 100 FROM attendance").fetchone()[0] or 0
    subjects = db.execute(
        "SELECT sub.name AS subject, ROUND(AVG(m.score), 1) AS average "
        "FROM marks m JOIN subjects sub ON sub.id = m.subject_id "
        "GROUP BY sub.id ORDER BY average DESC"
    ).fetchall()
    top = db.execute(
        "SELECT s.id, s.name, s.roll_no, ROUND(AVG(m.score), 1) AS average "
        "FROM students s JOIN marks m ON m.student_id = s.id "
        "GROUP BY s.id ORDER BY average DESC LIMIT 5"
    ).fetchall()
    trend = db.execute(
        "SELECT date, ROUND(AVG(present) * 100, 1) AS percent, COUNT(*) AS records "
        "FROM attendance GROUP BY date ORDER BY date DESC LIMIT 14"
    ).fetchall()

    counts = {g_: 0 for g_ in GRADE_ORDER}
    for s in students:
        if s["average"] is not None:
            counts[s["grade"]] += 1
    at_risk = [s for s in students if s["at_risk"]]

    return {
        "students": len(students),
        "average_score": round(avg, 1),
        "average_attendance": round(att, 1),
        "subjects": [dict(r) for r in subjects],
        "top": [dict(r, grade=grade(r["average"])) for r in top],
        "grade_distribution": [{"grade": g_, "count": counts[g_]} for g_ in GRADE_ORDER],
        "attendance_trend": [dict(r) for r in reversed(trend)],
        "at_risk": at_risk,
        "at_risk_count": len(at_risk),
        "risk_rules": {"score": RISK_SCORE, "attendance": RISK_ATTENDANCE},
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
