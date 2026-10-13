import os
import sqlite3
import sys
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
HERE = os.path.dirname(os.path.abspath(__file__))
for path in (os.path.dirname(HERE), os.path.dirname(os.path.dirname(HERE))):
    sys.path.insert(0, path)

from app import app, init_db  # noqa: E402

client = app.test_client()


def new_student(roll, name="Test", course="BSc IT"):
    return client.post("/api/students", json={"roll_no": roll, "name": name, "course": course}).json["id"]


def test_health():
    assert client.get("/health").json == {"status": "ok"}


def test_student_marks_and_report():
    sid = new_student("R1", "Asha")
    client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 90})
    client.post("/api/marks", json={"student_id": sid, "subject": "Physics", "score": 80})
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-06", "present": True})
    report = client.get(f"/api/students/{sid}/report").json
    assert report["average"] == 85.0
    assert report["grade"] == "A"
    assert report["attendance_percent"] == 100.0
    assert report["at_risk"] is False


def test_duplicate_roll_rejected():
    new_student("R2")
    res = client.post("/api/students", json={"roll_no": "R2", "name": "B", "course": "C"})
    assert res.status_code == 409


def test_invalid_score_rejected():
    sid = new_student("R3")
    res = client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 150})
    assert res.status_code == 400


def test_same_subject_updates_instead_of_duplicating():
    sid = new_student("R4")
    client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 40})
    client.post("/api/marks", json={"student_id": sid, "subject": "maths", "score": 70})
    report = client.get(f"/api/students/{sid}/report").json
    assert report["subjects"] == {"Maths": 70.0}


def test_attendance_is_one_entry_per_day():
    sid = new_student("R5")
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-07", "present": True})
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-07", "present": False})
    report = client.get(f"/api/students/{sid}/report").json
    assert report["days_recorded"] == 1
    assert report["attendance_percent"] == 0.0


def test_bad_date_rejected():
    sid = new_student("R6")
    res = client.post("/api/attendance", json={"student_id": sid, "date": "yesterday", "present": True})
    assert res.status_code == 400


def test_at_risk_flagged_with_reasons():
    sid = new_student("R7", "Ravi")
    client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 35})
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-08", "present": False})
    row = next(s for s in client.get("/api/students").json if s["id"] == sid)
    assert row["at_risk"] is True
    assert len(row["risk_reasons"]) == 2
    summary = client.get("/api/summary").json
    assert any(s["id"] == sid for s in summary["at_risk"])
    assert summary["at_risk_count"] >= 1


def test_summary_has_chart_data():
    data = client.get("/api/summary").json
    assert [g["grade"] for g in data["grade_distribution"]] == ["A+", "A", "B", "C", "D", "F"]
    assert sum(g["count"] for g in data["grade_distribution"]) >= 1
    assert data["attendance_trend"], "attendance trend should have at least one day"
    assert "Maths" in client.get("/api/subjects").json


def test_pdf_report_card():
    sid = new_student("R8", "Meera")
    client.post("/api/marks", json={"student_id": sid, "subject": "Chemistry", "score": 88})
    res = client.get(f"/api/students/{sid}/report.pdf")
    assert res.status_code == 200
    assert res.mimetype == "application/pdf"
    assert res.data.startswith(b"%PDF")
    assert client.get("/api/students/99999/report.pdf").status_code == 404


def test_old_database_is_upgraded_without_losing_data(tmp_path):
    path = str(tmp_path / "legacy.db")
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, roll_no TEXT UNIQUE NOT NULL,
                               name TEXT NOT NULL, course TEXT NOT NULL);
        CREATE TABLE marks (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL,
                            subject TEXT NOT NULL, score REAL NOT NULL);
        CREATE TABLE attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL,
                                 date TEXT NOT NULL, present INTEGER NOT NULL);
        INSERT INTO students (roll_no, name, course) VALUES ('L1', 'Old', 'BCA');
        INSERT INTO marks (student_id, subject, score) VALUES (1, 'Maths', 70), (1, 'Maths', 90), (1, 'Stats', 60);
        INSERT INTO attendance (student_id, date, present) VALUES (1, '2026-10-01', 1), (1, '2026-10-01', 1);
        """
    )
    con.commit()
    con.close()

    init_db(path)

    con = sqlite3.connect(path)
    marks = con.execute(
        "SELECT sub.name, m.score FROM marks m JOIN subjects sub ON sub.id = m.subject_id ORDER BY sub.name"
    ).fetchall()
    assert marks == [("Maths", 90.0), ("Stats", 60.0)]
    assert con.execute("SELECT COUNT(*) FROM attendance").fetchone()[0] == 1
    assert con.execute("SELECT COUNT(*) FROM students").fetchone()[0] == 1
    con.close()


def test_edit_student():
    sid = new_student("E1", "Old Name", "BCA")
    res = client.put(f"/api/students/{sid}", json={"roll_no": "E1", "name": "New Name", "course": "BSc IT"})
    assert res.status_code == 200
    row = next(s for s in client.get("/api/students").json if s["id"] == sid)
    assert (row["name"], row["course"]) == ("New Name", "BSc IT")


def test_edit_student_rejects_duplicate_roll_and_missing_student():
    a = new_student("E2")
    new_student("E3")
    assert client.put(f"/api/students/{a}", json={"roll_no": "E3", "name": "x", "course": "y"}).status_code == 409
    assert client.put(f"/api/students/{a}", json={"roll_no": "E2", "name": "", "course": "y"}).status_code == 400
    assert client.put("/api/students/99999", json={"roll_no": "Z", "name": "x", "course": "y"}).status_code == 404


def test_edit_and_delete_marks():
    sid = new_student("M1")
    client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 40})
    client.post("/api/marks", json={"student_id": sid, "subject": "Physics", "score": 60})
    marks = client.get(f"/api/students/{sid}/marks").json
    assert [m["subject"] for m in marks] == ["Maths", "Physics"]

    maths = marks[0]["id"]
    assert client.put(f"/api/marks/{maths}", json={"score": 95}).status_code == 200
    assert client.put(f"/api/marks/{maths}", json={"score": 101}).status_code == 400
    assert client.put("/api/marks/99999", json={"score": 50}).status_code == 404

    assert client.delete(f"/api/marks/{marks[1]['id']}").status_code == 204
    assert client.delete(f"/api/marks/{marks[1]['id']}").status_code == 404
    left = client.get(f"/api/students/{sid}/marks").json
    assert [(m["subject"], m["score"]) for m in left] == [("Maths", 95.0)]


def test_class_attendance_in_one_request():
    a, b = new_student("C1"), new_student("C2")
    res = client.post("/api/attendance/bulk", json={"date": "2026-11-02", "records": [
        {"student_id": a, "present": True}, {"student_id": b, "present": False}]})
    assert res.status_code == 201 and res.json["saved"] == 2
    day = {r["student_id"]: r["present"] for r in client.get("/api/attendance?date=2026-11-02").json}
    assert day[a] is True and day[b] is False

    # saving the same day again updates instead of duplicating
    client.post("/api/attendance/bulk", json={"date": "2026-11-02", "records": [{"student_id": b, "present": True}]})
    day = {r["student_id"]: r["present"] for r in client.get("/api/attendance?date=2026-11-02").json}
    assert day[b] is True
    assert client.get(f"/api/students/{b}/report").json["days_recorded"] == 1


def test_class_attendance_is_all_or_nothing():
    a = new_student("C3")
    res = client.post("/api/attendance/bulk", json={"date": "2026-11-03", "records": [
        {"student_id": a, "present": True}, {"student_id": 99999, "present": True}]})
    assert res.status_code == 400
    assert client.get("/api/attendance?date=2026-11-03").json == []
    assert client.post("/api/attendance/bulk", json={"date": "nope", "records": [{"student_id": a, "present": True}]}).status_code == 400
    assert client.get("/api/attendance?date=nope").status_code == 400
