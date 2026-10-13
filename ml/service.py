"""Linear + logistic regression for predicting final-exam results.

Two models, trained on the same two features:
  * Linear regression   -> predicted final score (0-100)
  * Logistic regression -> probability that the final score is below the pass mark

By default they learn from a generated demo dataset (ml/demo_training_data.csv).
Once the school has MIN_REAL_STUDENTS students with mid-term marks, final marks and
attendance, the models can be retrained on that real data instead.
"""
import csv
import os
import threading
from datetime import datetime

import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, mean_absolute_error,
                             precision_score, r2_score, recall_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO_CSV = os.path.join(HERE, "demo_training_data.csv")

FEATURES = ["midterm_avg", "attendance"]
LABELS = {"midterm_avg": "Mid-term average", "attendance": "Attendance"}
PASS_MARK = 50.0
MIN_REAL_STUDENTS = 30
RANDOM_STATE = 42


class ModelError(Exception):
    """Raised with a user-friendly message when a model cannot be trained."""


class Bundle:
    def __init__(self, linear, scaler, logistic, meta):
        self.linear = linear
        self.scaler = scaler
        self.logistic = logistic
        self.meta = meta


_lock = threading.Lock()
_current = None


def current():
    return _current


def _load_demo():
    if not os.path.exists(DEMO_CSV):
        from ml.generate_demo_data import main
        main()
    with open(DEMO_CSV, newline="") as f:
        rows = [[float(r[c]) for c in FEATURES + ["final_avg"]] for r in csv.DictReader(f)]
    return np.array(rows, dtype=float)


def _coefs(values):
    return [{"feature": f, "label": LABELS[f], "value": round(float(v), 3)}
            for f, v in zip(FEATURES, values)]


def _fit(data, source, n_real):
    X, y = data[:, :2], data[:, 2]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE)
    fail_tr = (y_tr < PASS_MARK).astype(int)
    fail_te = (y_te < PASS_MARK).astype(int)
    if fail_tr.min() == fail_tr.max():
        raise ModelError("The training data needs both passing and failing students to learn from.")

    # Evaluate on a held-out 20% test split ...
    lin_eval = LinearRegression().fit(X_tr, y_tr)
    pred_te = np.clip(lin_eval.predict(X_te), 0, 100)
    scaler_eval = StandardScaler().fit(X_tr)
    log_eval = LogisticRegression(max_iter=1000).fit(scaler_eval.transform(X_tr), fail_tr)
    fail_hat = log_eval.predict(scaler_eval.transform(X_te))
    tn, fp, fn, tp = confusion_matrix(fail_te, fail_hat, labels=[0, 1]).ravel()

    # ... then refit on all the data for serving predictions.
    linear = LinearRegression().fit(X, y)
    scaler = StandardScaler().fit(X)
    logistic = LogisticRegression(max_iter=1000).fit(scaler.transform(X), (y < PASS_MARK).astype(int))

    meta = {
        "source": source,
        "source_label": ("Demo dataset (generated, not real students)" if source == "demo"
                         else "Your students' real data"),
        "n_total": int(len(data)), "n_train": int(len(X_tr)), "n_test": int(len(X_te)),
        "pass_mark": PASS_MARK,
        "trained_at": datetime.now().strftime("%d %b %Y, %H:%M"),
        "linear": {
            "r2": round(float(r2_score(y_te, pred_te)), 3),
            "mae": round(float(mean_absolute_error(y_te, pred_te)), 2),
            "intercept": round(float(linear.intercept_), 2),
            "coefficients": _coefs(linear.coef_),
        },
        "logistic": {
            "accuracy": round(float(accuracy_score(fail_te, fail_hat)), 3),
            "precision": round(float(precision_score(fail_te, fail_hat, zero_division=0)), 3),
            "recall": round(float(recall_score(fail_te, fail_hat, zero_division=0)), 3),
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "fail_rate": round(float((y < PASS_MARK).mean()), 3),
            "coefficients": _coefs(logistic.coef_[0]),
        },
        "scatter": [{"actual": round(float(a), 1), "predicted": round(float(p), 1)}
                    for a, p in zip(y_te, pred_te)],
    }
    return Bundle(linear, scaler, logistic, meta)


def train(source, real_rows):
    """source: 'auto' | 'demo' | 'real'. real_rows: [(midterm_avg, attendance, final_avg), ...]."""
    global _current
    n_real = len(real_rows)
    if source == "auto":
        source = "real" if n_real >= MIN_REAL_STUDENTS else "demo"
    if source == "real":
        if n_real < MIN_REAL_STUDENTS:
            raise ModelError(
                f"Training on your own data needs at least {MIN_REAL_STUDENTS} students with "
                f"mid-term marks, final marks and attendance. You have {n_real}.")
        data = np.array(real_rows, dtype=float)
    elif source == "demo":
        data = _load_demo()
    else:
        raise ModelError("Unknown data source")
    bundle = _fit(data, source, n_real)
    with _lock:
        _current = bundle
    return bundle


def risk_level(fail_percent):
    if fail_percent >= 60:
        return "High"
    if fail_percent >= 30:
        return "Medium"
    return "Low"


def predict(bundle, midterm_avg, attendance):
    x = np.array([[min(max(midterm_avg, 0), 100), min(max(attendance, 0), 100)]], dtype=float)
    final = float(np.clip(bundle.linear.predict(x)[0], 0, 100))
    z = bundle.scaler.transform(x)
    fail_p = float(bundle.logistic.predict_proba(z)[0][1]) * 100
    # How far each feature pushes the log-odds of failing away from the "average" student.
    effects = bundle.logistic.coef_[0] * z[0]
    drivers = [{"feature": f, "label": LABELS[f], "value": round(float(x[0][i]), 1),
                "effect": round(float(effects[i]), 2)} for i, f in enumerate(FEATURES)]
    worst = max(drivers, key=lambda d: d["effect"])
    return {
        "predicted_final": round(final, 1),
        "fail_probability": round(fail_p, 1),
        "risk_level": risk_level(fail_p),
        "drivers": drivers,
        "main_driver": worst["label"] if worst["effect"] > 0.25 else None,
    }
