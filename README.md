# Student-Performance-Management-System

A web app to manage students, marks and attendance, with analytics, PDF report cards and machine-learning predictions of who may fail the final exam.

## Features

- Add, edit, delete, search, sort and filter students
- Marks per subject and exam (Unit test, Mid-term, Final), with inline edit and delete
- Class attendance: mark the whole class for a day and save once
- Dashboard with grade distribution, attendance trend, subject averages and top performers
- At-risk detection (average below 50 or attendance below 75%)
- Predicted final score (linear regression) and chance of failing (logistic regression)
- What-if lab with sliders, and a Model page showing R², accuracy and a confusion matrix
- Student profile page and downloadable PDF report card
- CSV import and export

## Tech Stack

| Area | Tools |
|---|---|
| Backend | Python, Flask, SQLite |
| Frontend | React |
| Machine learning | scikit-learn, NumPy |
| DevOps | Docker, Docker Compose, Jenkins, Prometheus, Grafana |
| Testing | pytest |
| Workflow | Git, GitHub, Jira |

## Run It

**Backend (Docker)**

```bash
docker compose up -d --build
```

- API: http://localhost:5000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3003

**Or without Docker**

```bash
pip install -r requirements.txt
python app.py
```

**Frontend**

```bash
cd spms-frontend
npm install
npm start
```

Open http://localhost:3000

> Run only one backend at a time (Docker or `python app.py`), because both use port 5000.

## Tests

```bash
python -m pytest app/tests
```

## Machine Learning

The models learn from a generated demo dataset (`ml/demo_training_data.csv`), not real students. Once 30 students have mid-term marks, final marks and attendance, use **Retrain** on the Model page to train on real data.

## Project Structure

```
app.py              Flask API, database and rules
csv_io.py           CSV import and export
report_pdf.py       PDF report card
ml/                 Regression models and demo data
app/tests/          pytest tests
spms-frontend/src/  React app (pages and components)
Dockerfile, docker-compose.yml, prometheus.yml
```

## Author

Krisha Samtani