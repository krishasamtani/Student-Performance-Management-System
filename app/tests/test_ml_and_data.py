import io
import os
import sqlite3
import sys
import tempfile

os.environ.setdefault("DB_PATH", os.path.join(tempfile.mkdtemp(), "test.db"))
HERE = os.path.dirname(os.path.abspath(__file__))
for path in (os.path.dirname(HERE), os.path.dirname(os.path.dirname(HERE))):
    sys.path.insert(0, path)

from app import app, init_db  # noqa: E402

client = app.test_client()


def new_student(roll, name="Test", course="BSc IT"):
    return client.post("/api/students", json={"roll_no": roll, "name": name, "course": course}).json["id"]


def mark(sid, subject, score, exam="Mid-term"):
    return client.post("/api/marks", json={"student_id": sid, "subject": subject, "score": score, "exam_type": exam})


# ---------- exam types ----------

def test_marks_are_stored_per_exam():
    sid = new_student("X1", "Exam Kid")
    mark(sid, "Maths", 60, "Mid-term")
    mark(sid, "Maths", 80, "Final")
    mark(sid, "Maths", 90, "midterm")  # normalised to Mid-term, so this updates the first one
    report = client.get(f"/api/students/{sid}/report").json
    assert report["exams"] == [{"exam": "Mid-term", "average": 90.0}, {"exam": "Final", "average": 80.0}]
    assert report["subjects"] == {"Maths": 85.0}
    assert [(m["exam_type"], m["score"]) for m in report["marks"]] == [("Mid-term", 90.0), ("Final", 80.0)]


def test_invalid_exam_type_rejected():
    sid = new_student("X2")
    assert mark(sid, "Maths", 50, "Surprise quiz").status_code == 400


def test_v3_database_gets_exam_types(tmp_path):
    path = str(tmp_path / "v3.db")
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, roll_no TEXT UNIQUE NOT NULL,
                               name TEXT NOT NULL, course TEXT NOT NULL);
        CREATE TABLE subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
        CREATE TABLE marks (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL,
                            subject_id INTEGER NOT NULL, score REAL NOT NULL, UNIQUE (student_id, subject_id));
        CREATE INDEX idx_marks_subject ON marks(subject_id);
        INSERT INTO students (roll_no, name, course) VALUES ('V3', 'Kept', 'BCA');
        INSERT INTO subjects (name) VALUES ('Maths'), ('Stats');
        INSERT INTO marks (student_id, subject_id, score) VALUES (1, 1, 72), (1, 2, 64);
        """
    )
    con.commit()
    con.close()

    init_db(path)

    con = sqlite3.connect(path)
    rows = con.execute("SELECT exam_type, score FROM marks ORDER BY score").fetchall()
    assert rows == [("Mid-term", 64.0), ("Mid-term", 72.0)]
    index_names = [r[1] for r in con.execute("PRAGMA index_list(marks)")]
    assert "idx_marks_subject" in index_names
    con.close()


# ---------- courses, profile data ----------

def test_courses_summary():
    a = new_student("CO1", "A", "Course Alpha")
    b = new_student("CO2", "B", "Course Alpha")
    mark(a, "Maths", 90)
    mark(b, "Maths", 30)
    row = next(c for c in client.get("/api/courses").json if c["course"] == "Course Alpha")
    assert row["students"] == 2
    assert row["average_score"] == 60.0
    assert row["pass_rate"] == 50.0


def test_student_attendance_by_month():
    sid = new_student("AT1")
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-09-30", "present": True})
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-02", "present": False})
    october = client.get(f"/api/students/{sid}/attendance?month=2026-10").json
    assert october == [{"date": "2026-10-02", "present": False}]
    assert client.get(f"/api/students/{sid}/attendance?month=oct").status_code == 400
    assert client.get("/api/students/99999/attendance?month=2026-10").status_code == 404


# ---------- CSV export / import ----------

def test_export_csv():
    sid = new_student("EX1", "Exporter")
    mark(sid, "Maths", 88, "Final")
    marks_csv = client.get("/api/export/marks.csv")
    assert marks_csv.mimetype == "text/csv"
    assert "EX1,Exporter,Maths,Final,88.0" in marks_csv.get_data(as_text=True)
    assert "EX1" in client.get("/api/export/students.csv").get_data(as_text=True)
    assert client.get("/api/export/nope.csv").status_code == 404


def upload(kind, text):
    return client.post(f"/api/import/{kind}", data={"file": (io.BytesIO(text.encode()), "data.csv")},
                       content_type="multipart/form-data")


def test_import_students_reports_row_errors():
    new_student("IM1")
    res = upload("students", "roll_no,name,course\nIM1,Dup,BCA\nIM2,Fresh,BCA\nIM3,,BCA\n")
    body = res.json
    assert body["imported"] == 1 and body["skipped"] == 2
    assert {e["row"] for e in body["errors"]} == {2, 4}
    assert upload("students", "roll_no,name\nA,B\n").status_code == 400


def test_import_marks():
    sid = new_student("IM4", "Marker")
    res = upload("marks", "roll_no,subject,exam_type,score\nIM4,Maths,Final,81\nIM4,Maths,Quiz,50\nNOPE,Maths,Final,10\nIM4,Stats,,70\n")
    assert res.json["imported"] == 2 and res.json["skipped"] == 2
    got = {(m["subject"], m["exam_type"]): m["score"] for m in client.get(f"/api/students/{sid}/marks").json}
    assert got == {("Maths", "Final"): 81.0, ("Stats", "Mid-term"): 70.0}


# ---------- machine learning ----------

def test_model_learns_from_demo_data():
    meta = client.get("/api/ml/model").json
    assert meta["source"] == "demo"
    assert meta["linear"]["r2"] > 0.6
    assert meta["logistic"]["accuracy"] > 0.75
    assert meta["real_data"]["needed"] == 30
    c = meta["logistic"]["confusion"]
    assert c["tn"] + c["fp"] + c["fn"] + c["tp"] == meta["n_test"]


def test_predictions_move_in_the_right_direction():
    def predict(mid, att):
        return client.post("/api/ml/predict", json={"midterm_avg": mid, "attendance": att}).json

    strong, weak = predict(85, 95), predict(40, 45)
    assert strong["predicted_final"] > weak["predicted_final"]
    assert strong["fail_probability"] < weak["fail_probability"]
    assert predict(60, 40)["fail_probability"] > predict(60, 95)["fail_probability"]
    assert weak["risk_level"] == "High" and strong["risk_level"] == "Low"
    assert client.post("/api/ml/predict", json={"midterm_avg": 120, "attendance": 50}).status_code == 400


def test_student_predictions_need_data():
    ready = new_student("ML1", "Ready")
    mark(ready, "Maths", 70, "Mid-term")
    client.post("/api/attendance", json={"student_id": ready, "date": "2026-10-01", "present": True})
    no_att = new_student("ML2", "NoAtt")
    mark(no_att, "Maths", 70, "Mid-term")
    by_roll = {s["roll_no"]: s for s in client.get("/api/ml/predictions").json["students"]}
    assert by_roll["ML1"]["prediction"]["available"] is True
    assert by_roll["ML2"]["prediction"] == {"available": False, "reason": "Needs attendance"}
    assert client.get(f"/api/students/{ready}/report").json["prediction"]["available"] is True


def test_real_data_training_needs_enough_students():
    res = client.post("/api/ml/retrain", json={"source": "real"})
    assert res.status_code == 400
    assert "at least 30" in res.json["error"]
    assert client.post("/api/ml/retrain", json={"source": "demo"}).json["source"] == "demo"


def test_retrain_on_real_data_once_there_is_enough():
    import random
    rng = random.Random(7)
    for i in range(36):
        sid = new_student(f"RL{i}", f"Real {i}")
        attendance = rng.uniform(40, 100)
        midterm = max(5, min(100, 30 + 0.5 * attendance + rng.gauss(0, 12)))
        final = max(0, min(100, 0.7 * midterm + 0.2 * attendance + rng.gauss(0, 6)))
        mark(sid, "Maths", midterm, "Mid-term")
        mark(sid, "Maths", final, "Final")
        for day in range(1, 11):
            client.post("/api/attendance", json={"student_id": sid, "date": f"2026-09-{day:02d}",
                                                 "present": rng.random() < attendance / 100})
    meta = client.post("/api/ml/retrain", json={"source": "auto"}).json
    assert meta["source"] == "real"
    assert meta["n_total"] >= 30
    assert client.get("/api/ml/model").json["source"] == "real"
    client.post("/api/ml/retrain", json={"source": "demo"})  # leave the shared model in its default state
