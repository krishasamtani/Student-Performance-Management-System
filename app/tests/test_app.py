import os
import sys
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app  # noqa: E402

client = app.test_client()


def test_health():
    assert client.get("/health").json == {"status": "ok"}


def test_student_marks_and_report():
    sid = client.post("/api/students", json={
        "roll_no": "R1", "name": "Asha", "course": "BSc IT"}).json["id"]
    client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 90})
    client.post("/api/marks", json={"student_id": sid, "subject": "Physics", "score": 80})
    client.post("/api/attendance", json={"student_id": sid, "date": "2026-10-06", "present": True})
    report = client.get(f"/api/students/{sid}/report").json
    assert report["average"] == 85.0
    assert report["grade"] == "A"
    assert report["attendance_percent"] == 100.0


def test_duplicate_roll_rejected():
    client.post("/api/students", json={"roll_no": "R2", "name": "A", "course": "C"})
    res = client.post("/api/students", json={"roll_no": "R2", "name": "B", "course": "C"})
    assert res.status_code == 409


def test_invalid_score_rejected():
    sid = client.post("/api/students", json={
        "roll_no": "R3", "name": "Ravi", "course": "BCA"}).json["id"]
    res = client.post("/api/marks", json={"student_id": sid, "subject": "Maths", "score": 150})
    assert res.status_code == 400


def test_summary():
    data = client.get("/api/summary").json
    assert data["students"] >= 1
    assert "subjects" in data and "top" in data
