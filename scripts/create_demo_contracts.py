from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "demo-documents"
OUTPUT.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "ContractTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=17,
    leading=21,
    textColor=colors.HexColor("#15384b"),
    alignment=TA_CENTER,
    spaceAfter=10,
)
demo_style = ParagraphStyle(
    "Demo",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#a54832"),
    alignment=TA_CENTER,
    spaceAfter=16,
)
heading_style = ParagraphStyle(
    "ClauseHeading",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=13,
    textColor=colors.HexColor("#203845"),
    spaceBefore=10,
    spaceAfter=4,
)
body_style = ParagraphStyle(
    "ContractBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9,
    leading=14,
    textColor=colors.HexColor("#263843"),
    spaceAfter=7,
)
small_style = ParagraphStyle(
    "Small",
    parent=body_style,
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#5a6d78"),
)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d7e1e6"))
    canvas.line(0.75 * inch, 0.62 * inch, 7.75 * inch, 0.62 * inch)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#667985"))
    canvas.drawString(0.75 * inch, 0.42 * inch, "CONTRACTLEDGER AI - FICTIONAL PORTFOLIO DEMO")
    canvas.drawRightString(7.75 * inch, 0.42 * inch, f"Page {doc.page}")
    canvas.restoreState()


def metadata_table(rows):
    table = Table(rows, colWidths=[1.65 * inch, 4.95 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef5f7")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#244b5d")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("LEADING", (0, 0), (-1, -1), 11),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd9df")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def build_contract(path, title, metadata, clauses, signature=False):
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="ContractLedger AI Portfolio Demo",
        subject="Fictional contract for AI extraction demonstration",
    )
    story = [
        Paragraph(title.upper(), title_style),
        Paragraph("FICTIONAL DOCUMENT - CREATED ONLY FOR PORTFOLIO DEMONSTRATION", demo_style),
        metadata_table(metadata),
        Spacer(1, 10),
    ]
    for index, (heading, text) in enumerate(clauses, start=1):
        story.append(Paragraph(f"{index}. {heading}", heading_style))
        story.append(Paragraph(text, body_style))
    if signature:
        story.extend(
            [
                Spacer(1, 18),
                Paragraph("SIGNATURES", heading_style),
                Table(
                    [
                        ["NORTHSTAR INDUSTRIAL SERVICES, INC.", "CASCADE ENGINEERING ADVISORS LLC"],
                        ["/s/ Jordan Ellis", "/s/ Morgan Reyes"],
                        ["Jordan Ellis, VP Operations", "Morgan Reyes, Managing Director"],
                        ["Date: September 10, 2026", "Date: September 10, 2026"],
                    ],
                    colWidths=[3.3 * inch, 3.3 * inch],
                    style=[
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#263843")),
                        ("LINEABOVE", (0, 1), (-1, 1), 0.6, colors.HexColor("#8396a0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ],
                ),
            ]
        )
    if signature:
        story.extend([Spacer(1, 18), Paragraph("All names, organizations, values, and terms in this document are fictional. This sample does not provide legal advice and is not intended for execution.", small_style)])
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


draft_clauses = [
    ("Parties and Scope", "This Professional Services Agreement (the <b>Agreement</b>) is proposed between Northstar Industrial Services, Inc. (<b>Northstar</b>) and Westline Engineering Group LLC (<b>Supplier</b>). Supplier will provide engineering advisory and project coordination services described in Exhibit A."),
    ("Term", "The proposed term begins October 1, 2026 and expires September 30, 2027, unless earlier terminated in accordance with this Agreement."),
    ("Fees", "The total not-to-exceed value of this Agreement is <b>USD 285,000</b>. Supplier may not exceed this amount without a written amendment signed by authorized representatives of both parties."),
    ("Payment Terms", "Northstar will pay undisputed invoices within <b>sixty (60) days</b> after receipt of a complete and accurate invoice."),
    ("Automatic Renewal", "This Agreement will automatically renew for one additional twelve-month term unless either party gives written notice at least <b>sixty (60) days</b> before the expiration date."),
    ("Insurance", "Supplier will maintain commercial general liability and workers' compensation insurance and provide a current certificate of insurance before beginning work."),
    ("Limitation of Liability", "Supplier's aggregate liability will not exceed the total fees paid under this Agreement, except for confidentiality breaches, gross negligence, or willful misconduct."),
    ("Governing Law", "This Agreement is governed by the laws of the <b>State of New York</b>, without regard to conflicts-of-law principles."),
    ("Termination", "Either party may terminate for material breach if the breach remains uncured for thirty (30) days after written notice."),
]

executed_clauses = [
    ("Parties and Scope", "This Master Services Agreement (the <b>Agreement</b>) is entered into by Northstar Industrial Services, Inc. (<b>Northstar</b>) and Cascade Engineering Advisors LLC (<b>Supplier</b>). Supplier will perform engineering and compliance advisory services under written statements of work."),
    ("Term", "The Agreement is effective <b>September 15, 2026</b> and expires <b>September 14, 2027</b>, unless earlier terminated or renewed as provided below."),
    ("Contract Value", "The total not-to-exceed value for all services under this Agreement is <b>USD 325,000</b>. Any increase requires a written amendment signed by both parties."),
    ("Payment Terms", "Northstar will pay undisputed invoices within <b>thirty (30) days</b> after receipt of a complete and accurate invoice."),
    ("Renewal and Notice", "This Agreement will automatically renew for one additional twelve-month term unless either party provides written notice at least <b>sixty (60) days</b> before the expiration date."),
    ("Insurance", "Supplier must maintain commercial general liability insurance and deliver a certificate of insurance before beginning work. The certificate must remain current throughout the term."),
    ("Confidentiality", "Each party will protect the other party's confidential information and use it only to perform or receive services under this Agreement."),
    ("Limitation of Liability", "Except for excluded claims, each party's aggregate liability will not exceed the total fees paid or payable under this Agreement."),
    ("Governing Law", "This Agreement is governed by the laws of the <b>State of California</b>."),
    ("Termination and Closeout", "Either party may terminate for uncured material breach after thirty (30) days' written notice. Supplier must submit its final invoice within forty-five (45) days after termination or expiration."),
]

build_contract(
    OUTPUT / "01_Draft_Professional_Services_Agreement.pdf",
    "Draft Professional Services Agreement",
    [
        ["Proposed Supplier", "Westline Engineering Group LLC"],
        ["Draft Reference", "DRAFT-PSA-2026-041"],
        ["Proposed Value", "USD 285,000"],
        ["Document Status", "Draft - Under Review - Not Executed"],
    ],
    draft_clauses,
    signature=False,
)

build_contract(
    OUTPUT / "02_Executed_Master_Services_Agreement.pdf",
    "Master Services Agreement",
    [
        ["Supplier", "Cascade Engineering Advisors LLC"],
        ["Contract Number", "MSA-2026-104"],
        ["Current Value", "USD 325,000"],
        ["Document Status", "Executed September 10, 2026"],
    ],
    executed_clauses,
    signature=True,
)

print(f"Created demo contracts in {OUTPUT}")
