import io
import os
import re
import sqlite3
from datetime import datetime

from flask import Flask, Response, request, jsonify, g, send_file, send_from_directory
from prometheus_flask_exporter import PrometheusMetrics

from csv_io import parse_upload, to_csv
from ml import service as ml_service
from report_pdf import build_report_pdf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# A React production build (if present in ./static) is served by Flask.
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # CSV uploads up to 2 MB
PrometheusMetrics(app)  # exposes /metrics for Prometheus

DB_PATH = os.getenv("DB_PATH", os.path.join(BASE_DIR, "data", "spms.db"))

# Students count as "at risk" when they fall below either target.
RISK_SCORE = 50
RISK_ATTENDANCE = 75

GRADE_CUTOFFS = [(90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D")]
GRADE_ORDER = ["A+", "A", "B", "C", "D", "F"]

EXAM_TYPES = ["Unit test", "Mid-term", "Final"]
_EXAM_KEYS = {re.sub(r"[\s_-]", "", e.lower()): e for e in EXAM_TYPES}

# Normalized schema: subjects live in their own table, marks reference them (one score per
# student, subject and exam), and indexes cover the columns we filter and group by.
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
    exam_type TEXT NOT NULL DEFAULT 'Mid-term'
        CHECK (exam_type IN ('Unit test', 'Mid-term', 'Final')),
    score REAL NOT NULL CHECK (score BETWEEN 0 AND 100),
    UNIQUE (student_id, subject_id, exam_type)
);
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    present INTEGER NOT NULL CHECK (present IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam ON marks(exam_type);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
"""


def init_db(path=None):
    """Create the schema, and upgrade an older database in place (keeps your data)."""
    path = path or DB_PATH
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("PRAGMA foreign_keys = OFF")

    # Older marks tables have no exam_type (and the oldest stored the subject as text).
    cols = [r[1] for r in con.execute("PRAGMA table_info(marks)")]
    legacy = bool(cols) and "exam_type" not in cols
    if legacy:
        con.execute("ALTER TABLE marks RENAME TO marks_old")
        con.execute("DROP INDEX IF EXISTS idx_marks_subject")

    con.executescript(SCHEMA)

    if legacy:
        if "subject_id" in cols:
            con.execute(
                "INSERT OR REPLACE INTO marks (student_id, subject_id, exam_type, score) "
                "SELECT student_id, subject_id, 'Mid-term', score FROM marks_old ORDER BY id"
            )
        else:
            con.execute("INSERT OR IGNORE INTO subjects (name) SELECT DISTINCT TRIM(subject) FROM marks_old")
            con.execute(
                "INSERT OR REPLACE INTO marks (student_id, subject_id, exam_type, score) "
                "SELECT o.student_id, s.id, 'Mid-term', o.score FROM marks_old o "
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


@app.errorhandler(413)
def too_large(_):
    return {"error": "That file is too large (2 MB maximum)"}, 413


# ---------- helpers ----------

def normalize_exam(value):
    return _EXAM_KEYS.get(re.sub(r"[\s_-]", "", str(value).lower()))


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


def valid_day(value):
    try:
        datetime.strptime(str(value), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def save_mark(db, student_id, subject, exam, score):
    """Insert a score, or update it if that student already has this subject and exam."""
    db.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (subject,))
    subject_id = db.execute("SELECT id FROM subjects WHERE name = ?", (subject,)).fetchone()["id"]
    db.execute(
        "INSERT INTO marks (student_id, subject_id, exam_type, score) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(student_id, subject_id, exam_type) DO UPDATE SET score = excluded.score",
        (student_id, subject_id, exam, score),
    )


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


def student_features(db, sid=None):
    """Per student: mid-term average, final average and attendance (the model's inputs/target)."""
    rows = db.execute(
        """
        SELECT s.id, s.name, s.roll_no, s.course,
          AVG(CASE WHEN m.exam_type = 'Mid-term' THEN m.score END) AS midterm_avg,
          AVG(CASE WHEN m.exam_type = 'Final' THEN m.score END) AS final_avg,
          (SELECT AVG(present) * 100 FROM attendance a WHERE a.student_id = s.id) AS attendance
        FROM students s LEFT JOIN marks m ON m.student_id = s.id
        WHERE (? IS NULL OR s.id = ?)
        GROUP BY s.id ORDER BY s.roll_no
        """,
        (sid, sid),
    ).fetchall()
    return [dict(r) for r in rows]


def real_rows(db):
    return [(f["midterm_avg"], f["attendance"], f["final_avg"]) for f in student_features(db)
            if None not in (f["midterm_avg"], f["attendance"], f["final_avg"])]


def ensure_model(db):
    if ml_service.current() is None:
        ml_service.train("auto", real_rows(db))
    return ml_service.current()


def make_prediction(bundle, f):
    missing = []
    if f["midterm_avg"] is None:
        missing.append("mid-term marks")
    if f["attendance"] is None:
        missing.append("attendance")
    if missing:
        return {"available": False, "reason": "Needs " + " and ".join(missing)}
    out = ml_service.predict(bundle, f["midterm_avg"], f["attendance"])
    out["available"] = True
    return out


def build_report(db, sid):
    s = db.execute("SELECT * FROM students WHERE id = ?", (sid,)).fetchone()
    if s is None:
        return None
    marks = [dict(m) for m in db.execute(
        "SELECT m.id, sub.name AS subject, m.exam_type, m.score FROM marks m "
        "JOIN subjects sub ON sub.id = m.subject_id WHERE m.student_id = ?",
        (sid,),
    ).fetchall()]
    marks.sort(key=lambda m: (m["subject"].lower(), EXAM_TYPES.index(m["exam_type"])))
    att = db.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(present), 0) AS present "
        "FROM attendance WHERE student_id = ?",
        (sid,),
    ).fetchone()

    avg = sum(m["score"] for m in marks) / len(marks) if marks else None
    pct = 100 * att["present"] / att["total"] if att["total"] else None

    by_subject = {}
    for m in marks:
        by_subject.setdefault(m["subject"], []).append(m["score"])
    by_exam = {}
    for m in marks:
        by_exam.setdefault(m["exam_type"], []).append(m["score"])

    reasons = risk_reasons(avg, pct)
    feats = student_features(db, sid)[0]
    return {
        "id": sid,
        "name": s["name"],
        "roll_no": s["roll_no"],
        "course": s["course"],
        "average": round(avg, 2) if avg is not None else 0,
        "grade": grade(avg),
        "attendance_percent": round(pct, 1) if pct is not None else 0,
        "days_recorded": att["total"],
        "subjects": {k: round(sum(v) / len(v), 1) for k, v in by_subject.items()},
        "exams": [{"exam": e, "average": round(sum(by_exam[e]) / len(by_exam[e]), 1)}
                  for e in EXAM_TYPES if e in by_exam],
        "marks": marks,
        "at_risk": bool(reasons),
        "risk_reasons": reasons,
        "prediction": make_prediction(ensure_model(db), feats),
        "actual_final": round(feats["final_avg"], 1) if feats["final_avg"] is not None else None,
    }


# ---------- pages and health ----------

@app.get("/")
def home():
    if os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return {"message": "SPMS API is running."}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- students ----------

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


@app.delete("/api/students/<int:sid>")
def delete_student(sid):
    db = get_db()
    db.execute("DELETE FROM students WHERE id = ?", (sid,))
    db.commit()
    return "", 204


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


@app.get("/api/students/<int:sid>/marks")
def student_marks(sid):
    rows = [dict(r) for r in get_db().execute(
        "SELECT m.id, sub.name AS subject, m.exam_type, m.score FROM marks m "
        "JOIN subjects sub ON sub.id = m.subject_id WHERE m.student_id = ?",
        (sid,),
    ).fetchall()]
    rows.sort(key=lambda m: (m["subject"].lower(), EXAM_TYPES.index(m["exam_type"])))
    return jsonify(rows)


@app.get("/api/students/<int:sid>/attendance")
def student_attendance(sid):
    month = request.args.get("month", "")
    if not valid_day(month + "-01"):
        return {"error": "Choose a valid month (YYYY-MM)"}, 400
    db = get_db()
    if db.execute("SELECT 1 FROM students WHERE id = ?", (sid,)).fetchone() is None:
        return {"error": "Student not found"}, 404
    rows = db.execute(
        "SELECT date, present FROM attendance WHERE student_id = ? AND date LIKE ? ORDER BY date",
        (sid, month + "-%"),
    ).fetchall()
    return jsonify([{"date": r["date"], "present": bool(r["present"])} for r in rows])


# ---------- marks ----------

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
        exam = normalize_exam(d.get("exam_type", "Mid-term"))
        if not subject or exam is None or not 0 <= score <= 100:
            raise ValueError
        db = get_db()
        save_mark(db, d["student_id"], subject, exam, score)
        db.commit()
    except (KeyError, ValueError, TypeError, sqlite3.IntegrityError):
        return {"error": "Choose a student, subject and exam, and enter a score from 0 to 100"}, 400
    return {"status": "saved"}, 201


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


# ---------- attendance ----------

@app.post("/api/attendance")
def add_attendance():
    d = request.get_json(force=True)
    try:
        if not valid_day(d["date"]):
            raise ValueError
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


@app.get("/api/attendance")
def attendance_for_day():
    day = request.args.get("date", "")
    if not valid_day(day):
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
        if not valid_day(day) or not isinstance(records, list) or not records:
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


# ---------- dashboard and courses ----------

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


@app.get("/api/courses")
def courses():
    groups = {}
    for s in student_rows(get_db()):
        groups.setdefault(s["course"], []).append(s)

    def mean(values):
        return round(sum(values) / len(values), 1) if values else None

    out = []
    for name, items in sorted(groups.items()):
        avgs = [s["average"] for s in items if s["average"] is not None]
        atts = [s["attendance"] for s in items if s["attendance"] is not None]
        out.append({
            "course": name,
            "students": len(items),
            "average_score": mean(avgs),
            "average_attendance": mean(atts),
            "at_risk": sum(1 for s in items if s["at_risk"]),
            "pass_rate": round(100 * sum(1 for a in avgs if a >= RISK_SCORE) / len(avgs), 1) if avgs else None,
        })
    return jsonify(out)


# ---------- machine learning ----------

@app.get("/api/ml/model")
def ml_model():
    db = get_db()
    meta = dict(ensure_model(db).meta)
    meta["real_data"] = {"ready": len(real_rows(db)), "needed": ml_service.MIN_REAL_STUDENTS}
    return meta


@app.post("/api/ml/retrain")
def ml_retrain():
    d = request.get_json(silent=True) or {}
    source = d.get("source", "auto")
    db = get_db()
    try:
        bundle = ml_service.train(source, real_rows(db))
    except ml_service.ModelError as e:
        return {"error": str(e)}, 400
    meta = dict(bundle.meta)
    meta["real_data"] = {"ready": len(real_rows(db)), "needed": ml_service.MIN_REAL_STUDENTS}
    return meta


@app.post("/api/ml/predict")
def ml_predict():
    d = request.get_json(force=True)
    try:
        midterm, attendance = float(d["midterm_avg"]), float(d["attendance"])
        if not (0 <= midterm <= 100 and 0 <= attendance <= 100):
            raise ValueError
    except (KeyError, ValueError, TypeError):
        return {"error": "Mid-term average and attendance must be numbers from 0 to 100"}, 400
    return ml_service.predict(ensure_model(get_db()), midterm, attendance)


@app.get("/api/ml/predictions")
def ml_predictions():
    db = get_db()
    bundle = ensure_model(db)
    out = []
    for f in student_features(db):
        row = {k: f[k] for k in ("id", "name", "roll_no", "course")}
        row["midterm_avg"] = round(f["midterm_avg"], 1) if f["midterm_avg"] is not None else None
        row["attendance"] = round(f["attendance"], 1) if f["attendance"] is not None else None
        row["actual_final"] = round(f["final_avg"], 1) if f["final_avg"] is not None else None
        row["prediction"] = make_prediction(bundle, f)
        out.append(row)
    return {"source_label": bundle.meta["source_label"], "pass_mark": ml_service.PASS_MARK, "students": out}


# ---------- CSV export and import ----------

@app.get("/api/export/<kind>.csv")
def export_csv(kind):
    db = get_db()
    if kind == "students":
        headers = ["roll_no", "name", "course", "average", "grade", "attendance_percent", "status"]
        rows = [[s["roll_no"], s["name"], s["course"], s["average"], s["grade"], s["attendance"],
                 "At risk" if s["at_risk"] else "On track"] for s in student_rows(db)]
    elif kind == "marks":
        headers = ["roll_no", "name", "subject", "exam_type", "score"]
        rows = [list(r) for r in db.execute(
            "SELECT s.roll_no, s.name, sub.name, m.exam_type, m.score FROM marks m "
            "JOIN students s ON s.id = m.student_id JOIN subjects sub ON sub.id = m.subject_id "
            "ORDER BY s.roll_no, sub.name, m.exam_type").fetchall()]
    elif kind == "attendance":
        headers = ["roll_no", "name", "date", "status"]
        rows = [[r[0], r[1], r[2], "Present" if r[3] else "Absent"] for r in db.execute(
            "SELECT s.roll_no, s.name, a.date, a.present FROM attendance a "
            "JOIN students s ON s.id = a.student_id ORDER BY a.date, s.roll_no").fetchall()]
    else:
        return {"error": "Unknown export"}, 404
    return Response(
        to_csv(headers, rows),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={kind}.csv"},
    )


@app.post("/api/import/<kind>")
def import_csv(kind):
    if kind not in ("students", "marks"):
        return {"error": "Unknown import"}, 404
    upload = request.files.get("file")
    if upload is None:
        return {"error": "Choose a CSV file to import"}, 400
    required = ["roll_no", "name", "course"] if kind == "students" else ["roll_no", "subject", "score"]
    try:
        rows = parse_upload(upload, required)
    except ValueError as e:
        return {"error": str(e)}, 400
    if not rows:
        return {"error": "The file has no data rows"}, 400
    if len(rows) > 2000:
        return {"error": "Import at most 2000 rows at a time"}, 400

    db = get_db()
    imported, errors = 0, []
    for number, row in rows:
        try:
            if kind == "students":
                if not all(row.get(k) for k in required):
                    raise ValueError("Roll number, name and course are all required")
                db.execute("INSERT INTO students (roll_no, name, course) VALUES (?, ?, ?)",
                           (row["roll_no"], row["name"], row["course"]))
            else:
                student = db.execute("SELECT id FROM students WHERE roll_no = ?", (row["roll_no"],)).fetchone()
                if student is None:
                    raise ValueError(f"No student with roll number {row['roll_no']}")
                subject = " ".join(row["subject"].split())
                exam = normalize_exam(row.get("exam_type") or "Mid-term")
                if exam is None:
                    raise ValueError("Exam type must be Unit test, Mid-term or Final")
                try:
                    score = float(row["score"])
                except ValueError:
                    raise ValueError("Score must be a number")
                if not subject or not 0 <= score <= 100:
                    raise ValueError("Subject is required and score must be from 0 to 100")
                save_mark(db, student["id"], subject, exam, score)
            imported += 1
        except sqlite3.IntegrityError:
            errors.append({"row": number, "message": "Roll number already exists"})
        except ValueError as e:
            errors.append({"row": number, "message": str(e)})
    db.commit()
    return {"imported": imported, "skipped": len(errors), "errors": errors[:25]}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
