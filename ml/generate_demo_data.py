"""Creates the synthetic demo dataset the models are trained on.

This is NOT real student data and is never stored in the app's database.
Run `python -m ml.generate_demo_data` to rebuild demo_training_data.csv.
"""
import csv
import os

import numpy as np

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_training_data.csv")


def make_rows(n=200, seed=42):
    rng = np.random.default_rng(seed)
    ability = rng.normal(0, 1, n)                                    # hidden study strength
    attendance = np.clip(rng.normal(76, 15, n) + 4 * ability, 30, 100)
    midterm = np.clip(56 + 11 * ability + 0.22 * (attendance - 76) + rng.normal(0, 6, n), 5, 100)
    final = np.clip(3 + 0.62 * midterm + 0.26 * attendance + rng.normal(0, 5.5, n), 0, 100)
    return np.column_stack([midterm, attendance, final]).round(1)


def main():
    rows = make_rows()
    with open(OUT, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["midterm_avg", "attendance", "final_avg"])
        writer.writerows(rows.tolist())
    print(f"wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
