from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from create_demo_source_documents import (
    LINE,
    NAVY,
    PALE,
    build_qualification_record,
    footer,
    info_table,
    p,
    styles,
)


OUTPUT = Path("output/pdf")
OUTPUT.mkdir(parents=True, exist_ok=True)


def build_w9():
    path = OUTPUT / "11_Canyon_Ridge_Demo_W9.pdf"
    doc = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.76 * inch,
        title="Canyon Ridge Demo W-9 Supplier Tax Record",
    )
    story = [
        Paragraph("SUPPLIER TAX RECORD - W-9 DEMO", styles["DocTitle"]),
        Paragraph("Fictional onboarding evidence for a new supplier", styles["Subtitle"]),
        Paragraph("DEMO ONLY - NOT AN IRS FORM AND NOT VALID FOR TAX REPORTING", styles["Demo"]),
        Spacer(1, 12),
        info_table([
            ("Legal name", "Canyon Ridge Data Services LLC"),
            ("Business name", "Canyon Ridge Data Services"),
            ("Federal tax classification", "LLC - C Corporation"),
            ("Business address", "880 Innovation Way, Suite 240, Sacramento, CA 95814"),
            ("Taxpayer ID", "XX-XXX2468 (masked fictional value)"),
            ("Certification date", "August 12, 2026"),
        ]),
        Paragraph("Certification", styles["Section"]),
        p("The authorized representative certifies for this fictional demonstration that the legal name, business name, federal tax classification, and business address shown above are accurate. The masked identifier contains no real taxpayer information."),
        Spacer(1, 14),
        Table([
            [Paragraph("Authorized representative", styles["Label"]), Paragraph("Maya Chen, Chief Operating Officer", styles["BodySmall"])],
            [Paragraph("Supplier email", styles["Label"]), Paragraph("vendor.records@canyonridgedemo.example", styles["BodySmall"])],
            [Paragraph("Supplier phone", styles["Label"]), Paragraph("(916) 555-0146", styles["BodySmall"])],
            [Paragraph("Website", styles["Label"]), Paragraph("https://canyonridgedemo.example", styles["BodySmall"])],
        ], colWidths=[1.65 * inch, 5.35 * inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("BACKGROUND", (0, 0), (0, -1), PALE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


def build_insurance():
    path = OUTPUT / "12_Canyon_Ridge_Demo_Insurance_Certificate.pdf"
    doc = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=0.62 * inch,
        leftMargin=0.62 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.76 * inch,
        title="Canyon Ridge Demo Certificate of Liability Insurance",
    )
    coverage = [
        [Paragraph("Coverage", styles["WhiteLabel"]), Paragraph("Policy number", styles["WhiteLabel"]), Paragraph("Effective", styles["WhiteLabel"]), Paragraph("Expires", styles["WhiteLabel"]), Paragraph("Limit", styles["WhiteLabel"])],
        [p("Commercial General Liability"), p("CGL-DEMO-67311"), p("08/01/2026"), p("07/31/2027"), p("$2,000,000 aggregate")],
        [p("Technology E&O"), p("TECH-DEMO-98144"), p("08/01/2026"), p("07/31/2027"), p("$2,000,000 each claim")],
        [p("Cyber Liability"), p("CYB-DEMO-33480"), p("08/01/2026"), p("07/31/2027"), p("$1,000,000 aggregate")],
    ]
    table = Table(coverage, colWidths=[1.65 * inch, 1.42 * inch, 0.92 * inch, 0.92 * inch, 1.42 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story = [
        Paragraph("CERTIFICATE OF LIABILITY INSURANCE - DEMO", styles["DocTitle"]),
        Paragraph("Fictional supplier qualification document", styles["Subtitle"]),
        Paragraph("DEMO ONLY - NO INSURANCE COVERAGE IS PROVIDED", styles["Demo"]),
        Spacer(1, 10),
        info_table([
            ("Producer", "Capitol Risk Partners, License DEMO-2108 (fictional)"),
            ("Named insured", "Canyon Ridge Data Services LLC, 880 Innovation Way, Suite 240, Sacramento, CA 95814"),
            ("Business activity", "Data services, cloud migration, and managed technology support"),
            ("Certificate date", "August 15, 2026"),
        ], widths=(1.45 * inch, 5.65 * inch)),
        Paragraph("Coverage summary", styles["Section"]),
        table,
        Paragraph("Description of operations", styles["Section"]),
        p("Evidence of fictional coverage for data services, cloud migration, and managed technology support. Qualification follow-up is required before July 31, 2027."),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


def build_business_license():
    return build_qualification_record(
        "13_Canyon_Ridge_Demo_Business_License.pdf",
        "BUSINESS LICENSE - DEMO",
        "New supplier qualification record for Canyon Ridge Data Services LLC",
        [
            ("License holder", "Canyon Ridge Data Services LLC"),
            ("DBA", "Canyon Ridge Data Services"),
            ("License number", "BL-DEMO-2026-0872"),
            ("Issuing jurisdiction", "City of Sacramento Business Operations Office (fictional)"),
            ("Business activity", "Data services, cloud migration, and managed technology support"),
            ("Business address", "880 Innovation Way, Suite 240, Sacramento, CA 95814"),
            ("Primary contact", "Maya Chen, Chief Operating Officer"),
            ("Email", "vendor.records@canyonridgedemo.example"),
            ("Phone", "(916) 555-0146"),
            ("Website", "https://canyonridgedemo.example"),
            ("Issue date", "August 1, 2026"),
            ("Expiration date", "July 31, 2027"),
            ("Record status", "Active - fictional portfolio data"),
        ],
        [
            ("Scope of record", "This fictional business license supports creation of a new supplier master from uploaded qualification evidence."),
            ("Renewal control", "The record should be reviewed before July 31, 2027 and replaced when a current license is received."),
        ],
    )


if __name__ == "__main__":
    for generated in (build_w9(), build_insurance(), build_business_license()):
        print(generated)
