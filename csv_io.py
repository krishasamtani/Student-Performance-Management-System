"""Small helpers for CSV import and export."""
import csv
import io


def parse_upload(file_storage, required):
    """Read an uploaded CSV into [(row_number, {column: value}), ...]. Raises ValueError for bad files."""
    try:
        text = file_storage.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("The file must be a UTF-8 CSV exported from Excel or Google Sheets")
    reader = csv.DictReader(io.StringIO(text))
    headers = [(h or "").strip().lower() for h in (reader.fieldnames or [])]
    missing = [c for c in required if c not in headers]
    if missing:
        raise ValueError("Missing column(s): " + ", ".join(missing))
    rows = []
    for number, raw in enumerate(reader, start=2):  # row 1 is the header
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items() if k}
        if any(row.values()):
            rows.append((number, row))
    return rows


def to_csv(headers, rows):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    writer.writerows(rows)
    return "\ufeff" + out.getvalue()  # BOM so Excel opens it with the right encoding
