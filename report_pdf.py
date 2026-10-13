"""Builds the downloadable PDF report card for one student."""
import io
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#10243e")
TEAL = colors.HexColor("#0e9f8e")
AMBER = colors.HexColor("#d98a0b")
RED = colors.HexColor("#d64550")
MUTED = colors.HexColor("#647286")
LINE = colors.HexColor("#dde4ec")
PAPER = colors.HexColor("#f4f7fa")
CONTENT_WIDTH = 170 * mm


def _tone(score):
    if score >= 75:
        return TEAL
    if score >= 50:
        return AMBER
    return RED


def _remark(score):
    if score >= 75:
        return "Strong"
    if score >= 50:
        return "Satisfactory"
    return "Needs improvement"


def _bars(subjects):
    row_h, label_w = 20, 120
    bar_w = CONTENT_WIDTH - label_w - 40
    height = row_h * len(subjects)
    drawing = Drawing(CONTENT_WIDTH, height)
    for i, (name, score) in enumerate(subjects.items()):
        y = height - (i + 1) * row_h + 6
        drawing.add(String(0, y + 1, name[:24], fontName="Helvetica", fontSize=9, fillColor=INK))
        drawing.add(Rect(label_w, y, bar_w, 9, fillColor=colors.HexColor("#edf1f6"), strokeColor=None))
        drawing.add(Rect(label_w, y, bar_w * min(score, 100) / 100, 9, fillColor=_tone(score), strokeColor=None))
        drawing.add(String(label_w + bar_w + 8, y + 1, f"{score:g}", fontName="Helvetica-Bold",
                           fontSize=9, fillColor=INK))
    return drawing


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm, "Student Performance Management System")
    canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_report_pdf(report):
    """report is the dict returned by build_report() in app.py. Returns PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Report card - {report['name']}",
    )
    base = getSampleStyleSheet()["Normal"]
    title = ParagraphStyle("title", parent=base, fontName="Helvetica-Bold", fontSize=20,
                           textColor=colors.white, leading=24)
    sub = ParagraphStyle("sub", parent=base, fontSize=9, textColor=colors.HexColor("#b8c7da"))
    h2 = ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=12,
                        textColor=INK, spaceBefore=16, spaceAfter=8)
    body = ParagraphStyle("body", parent=base, fontSize=10, textColor=INK, leading=14)

    header = Table(
        [[Paragraph("Student Performance Report Card", title)],
         [Paragraph(f"Generated on {datetime.now():%d %b %Y}", sub)]],
        colWidths=[CONTENT_WIDTH],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INK),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, 0), 14),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
    ]))

    details = Table(
        [[Paragraph(f"<b>{escape(report['name'])}</b>", body),
          Paragraph(f"Roll no: {escape(report['roll_no'])}", body),
          Paragraph(f"Course: {escape(report['course'])}", body)]],
        colWidths=[70 * mm, 45 * mm, 55 * mm],
    )
    details.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 12)]))

    at_risk = report["at_risk"]
    summary = Table(
        [["Average score", "Grade", "Attendance", "Status"],
         [f"{report['average']:g}", report["grade"], f"{report['attendance_percent']:g}%",
          "At risk" if at_risk else "On track"]],
        colWidths=[CONTENT_WIDTH / 4] * 4,
    )
    summary.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"), ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"), ("FONTSIZE", (0, 1), (-1, 1), 18),
        ("TEXTCOLOR", (0, 1), (-1, 1), INK),
        ("TEXTCOLOR", (3, 1), (3, 1), RED if at_risk else TEAL),
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))

    story = [header, details, Spacer(1, 10), summary, Paragraph("Subject scores", h2)]

    subjects = report["subjects"]
    if subjects:
        story.append(_bars(subjects))
        story.append(Spacer(1, 8))
        rows = [["Subject", "Score", "Remark"]] + [
            [name, f"{score:g}", _remark(score)] for name, score in subjects.items()]
        table = Table(rows, colWidths=[85 * mm, 30 * mm, 55 * mm])
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED), ("TEXTCOLOR", (0, 1), (-1, -1), INK),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No marks have been recorded yet.", body))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Attendance: {report['attendance_percent']:g}% across {report['days_recorded']} recorded days.", body))

    if at_risk:
        story.append(Paragraph("Areas needing attention", h2))
        for reason in report["risk_reasons"]:
            story.append(Paragraph(f"&bull; {escape(reason)}", body))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
