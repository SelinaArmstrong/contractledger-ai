from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path("output/pdf/14_Apex_Equipment_Amendment_No_2.pdf")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(0.72 * inch, 0.45 * inch, "FICTIONAL PORTFOLIO DEMO - NOT A REAL AGREEMENT")
    canvas.drawRightString(7.78 * inch, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DemoBanner",
            parent=styles["Normal"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0F5F7A"),
            backColor=colors.HexColor("#E8F5F8"),
            borderColor=colors.HexColor("#A9D3DE"),
            borderWidth=0.6,
            borderPadding=8,
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="AgreementTitle",
            parent=styles["Title"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=22,
            textColor=colors.HexColor("#183447"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="AgreementSubtitle",
            parent=styles["Normal"],
            alignment=TA_CENTER,
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#526775"),
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#183447"),
            spaceBefore=13,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyContract",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=14,
            textColor=colors.HexColor("#293B46"),
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Signature",
            parent=styles["BodyText"],
            fontSize=9,
            leading=15,
            textColor=colors.HexColor("#293B46"),
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.72 * inch,
        title="Amendment No. 2 - Equipment Supply Agreement",
        author="Northstar Infrastructure Services - Fictional Demo",
    )
    story = [
        Paragraph("FICTIONAL PORTFOLIO DEMO DOCUMENT", styles["DemoBanner"]),
        Paragraph("AMENDMENT NO. 2", styles["AgreementTitle"]),
        Paragraph(
            "TO EQUIPMENT SUPPLY AGREEMENT<br/>Contract No. CT-2026-004",
            styles["AgreementSubtitle"],
        ),
        Paragraph(
            "This Amendment No. 2 (the <b>Amendment</b>) is entered into as of August 28, 2026, by and between Northstar Infrastructure Services, Inc. (the <b>Customer</b>) and Apex Equipment LLC (the <b>Supplier</b>). The Amendment becomes effective September 1, 2026.",
            styles["BodyContract"],
        ),
        Paragraph("1. Agreement Reference", styles["Section"]),
        Paragraph(
            "The parties previously entered into the Equipment Supply Agreement identified as Contract No. CT-2026-004, effective February 1, 2026, as amended by Amendment No. 1. The current contract value immediately before this Amendment is USD 475,000 and the current expiration date is January 31, 2027.",
            styles["BodyContract"],
        ),
        Paragraph("2. Additional Equipment and Scope", styles["Section"]),
        Paragraph(
            "Supplier will provide six additional filtration units, related mounting hardware, commissioning support, and operator orientation for Customer's Sacramento facility. Delivery of the additional equipment will occur no later than November 15, 2026. All acceptance requirements in the Agreement remain applicable.",
            styles["BodyContract"],
        ),
        Paragraph("3. Price Adjustment", styles["Section"]),
        Paragraph(
            "The contract price is increased by USD 75,000. After this Amendment, the total current contract value is USD 550,000. This price adjustment includes equipment, freight, commissioning support, and operator orientation described in Section 2.",
            styles["BodyContract"],
        ),
        Paragraph("4. Term Extension", styles["Section"]),
        Paragraph(
            "The term of the Agreement is extended through June 30, 2027. The prior expiration date of January 31, 2027 is replaced by June 30, 2027.",
            styles["BodyContract"],
        ),
        Paragraph("5. Payment Terms", styles["Section"]),
        Paragraph(
            "Beginning on the Amendment effective date, Customer will pay each undisputed invoice within thirty (30) days after receipt of a correct invoice. This Net 30 term replaces the prior Net 45 payment term.",
            styles["BodyContract"],
        ),
        Paragraph("6. Renewal and Notice", styles["Section"]),
        Paragraph(
            "The Agreement will not renew automatically. Any further extension requires a written agreement signed by both parties. Either party may decline an extension by providing at least thirty (30) days' written notice before the then-current expiration date.",
            styles["BodyContract"],
        ),
        Paragraph("7. Continuing Effect", styles["Section"]),
        Paragraph(
            "Except as expressly modified by this Amendment, all other terms of the Agreement remain unchanged and in full force and effect. If this Amendment conflicts with the Agreement, this Amendment controls solely with respect to the subject matter stated above.",
            styles["BodyContract"],
        ),
        Spacer(1, 12),
        Table(
            [
                [
                    Paragraph("NORTHSTAR INFRASTRUCTURE SERVICES, INC.<br/><br/>By: /s/ Jordan Reyes<br/>Name: Jordan Reyes<br/>Title: VP, Procurement<br/>Date: August 28, 2026", styles["Signature"]),
                    Paragraph("APEX EQUIPMENT LLC<br/><br/>By: /s/ Rachel Kim<br/>Name: Rachel Kim<br/>Title: Authorized Representative<br/>Date: August 28, 2026", styles["Signature"]),
                ]
            ],
            colWidths=[3.35 * inch, 3.35 * inch],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD8DE")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD8DE")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7FAFB")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ]
            ),
        ),
        Spacer(1, 10),
        Paragraph(
            "Demo control note: This document was created only to demonstrate AI-assisted amendment extraction, human verification, version history, current-term recalculation, and obligation rescheduling.",
            ParagraphStyle(
                name="ControlNote",
                parent=styles["BodyContract"],
                fontSize=8.4,
                leading=12,
                textColor=colors.HexColor("#607481"),
                backColor=colors.HexColor("#F1F6F8"),
                borderPadding=7,
            ),
        ),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_pdf()
