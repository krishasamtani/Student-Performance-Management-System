import os
import sqlite3
from flask import Flask, request, jsonify, render_template, g
from flask_cors import CORS
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

app = Flask(__name__)
CORS(app)

DB_PATH = os.getenv("DB_PATH", "data/spms.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    course TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    score REAL NOT NULL CHECK (score BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    present INTEGER NOT NULL
);
"""


def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.executescript(SCHEMA)
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def grade(avg):
    for cutoff, letter in [(90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D")]:
        if avg >= cutoff:
            return letter
    return "F"


@app.get("/")
def home():
    return jsonify({"status": "SPMS Backend is running successfully!"})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# Native Prometheus Metrics Endpoint (Works perfectly with Gunicorn & Docker)
@app.get("/metrics")
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


@app.get("/api/students")
def list_students():
    db = get_db()
    query = """
        SELECT s.*, 
               (SELECT ROUND(100.0 * SUM(present) / COUNT(*), 1) 
                FROM attendance a WHERE a.student_id = s.id) AS attendance,
               (SELECT ROUND(AVG(score), 2) 
                FROM marks m WHERE m.student_id = s.id) AS average
        FROM students s
        ORDER BY s.roll_no
    """
    rows = db.execute(query).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        avg = d.get("average")
        d["grade"] = grade(avg) if avg is not None else "-"
        result.append(d)
    return jsonify(result)


@app.post("/api/students")
def add_student():
    d = request.get_json(force=True)
    if not all(d.get(k) for k in ("roll_no", "name", "course")):
        return {"error": "roll_no, name and course are required"}, 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO students (roll_no, name, course) VALUES (?, ?, ?)",
            (d["roll_no"], d["name"], d["course"]),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return {"error": "Roll number already exists"}, 409
    return {"id": cur.lastrowid}, 201


@app.delete("/api/students/<int:sid>")
def delete_student(sid):
    db = get_db()
    db.execute("DELETE FROM students WHERE id = ?", (sid,))
    db.commit()
    return "", 204


@app.post("/api/marks")
def add_mark():
    d = request.get_json(force=True)
    try:
        score = float(d["score"])
        if not 0 <= score <= 100:
            raise ValueError
        db = get_db()
        db.execute(
            "INSERT INTO marks (student_id, subject, score) VALUES (?, ?, ?)",
            (d["student_id"], d["subject"], score),
        )
        db.commit()
    except (KeyError, ValueError, sqlite3.IntegrityError):
        return {"error": "Invalid student, subject or score (0-100)"}, 400
    return {"status": "saved"}, 201


@app.post("/api/attendance")
def add_attendance():
    d = request.get_json(force=True)
    try:
        db = get_db()
        db.execute(
            "INSERT INTO attendance (student_id, date, present) VALUES (?, ?, ?)",
            (d["student_id"], d["date"], 1 if d["present"] else 0),
        )
        db.commit()
    except (KeyError, sqlite3.IntegrityError):
        return {"error": "Invalid student or date"}, 400
    return {"status": "saved"}, 201


@app.get("/api/students/<int:sid>/report")
def report(sid):
    db = get_db()
    s = db.execute("SELECT * FROM students WHERE id = ?", (sid,)).fetchone()
    if s is None:
        return {"error": "Student not found"}, 404
    marks = db.execute(
        "SELECT subject, score FROM marks WHERE student_id = ?", (sid,)
    ).fetchall()
    
    attendance_rows = db.execute(
        "SELECT date, present FROM attendance WHERE student_id = ? ORDER BY date DESC", (sid,)
    ).fetchall()
    
    att = db.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(present), 0) AS present "
        "FROM attendance WHERE student_id = ?", (sid,)
    ).fetchone()
    
    avg = sum(m["score"] for m in marks) / len(marks) if marks else 0
    pct = 100 * att["present"] / att["total"] if att["total"] else 0
    
    return {
        "name": s["name"], "roll_no": s["roll_no"], "course": s["course"],
        "average": round(avg, 2), "grade": grade(avg) if marks else "-",
        "attendance_percent": round(pct, 1),
        "subjects": {m["subject"]: m["score"] for m in marks},
        "attendance_history": [{"date": r["date"], "present": bool(r["present"])} for r in attendance_rows]
    }


@app.get("/api/summary")
def summary():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    avg = db.execute("SELECT AVG(score) FROM marks").fetchone()[0] or 0
    att = db.execute("SELECT AVG(present) * 100 FROM attendance").fetchone()[0] or 0
    
    subjects_rows = db.execute(
        "SELECT subject, ROUND(AVG(score), 1) AS average FROM marks GROUP BY subject ORDER BY subject"
    ).fetchall()
    subjects = [dict(r) for r in subjects_rows]

    top_rows = db.execute(
        """
        SELECT s.id, s.name, s.roll_no, ROUND(AVG(m.score), 1) AS average
        FROM students s
        JOIN marks m ON s.id = m.student_id
        GROUP BY s.id
        ORDER BY average DESC
        LIMIT 5
        """
    ).fetchall()
    top = []
    for r in top_rows:
        d = dict(r)
        d["grade"] = grade(d["average"])
        top.append(d)

    return {
        "students": total, 
        "average_score": round(avg, 1),
        "average_attendance": round(att, 1),
        "subjects": subjects,
        "top": top
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)