from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path("output/pdf")
OUTPUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#15384A")
TEAL = colors.HexColor("#2A7A94")
PALE = colors.HexColor("#EAF3F6")
LINE = colors.HexColor("#C9D8DF")
INK = colors.HexColor("#233744")
MUTED = colors.HexColor("#617580")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=MUTED, alignment=TA_CENTER, spaceAfter=16))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=NAVY, spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=13.5, textColor=INK, alignment=TA_LEFT, spaceAfter=7))
styles.add(ParagraphStyle(name="Tiny", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="Label", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name="WhiteLabel", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name="Demo", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.HexColor("#9A5A17"), alignment=TA_CENTER))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(0.72 * inch, 0.58 * inch, 7.78 * inch, 0.58 * inch)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.72 * inch, 0.38 * inch, "FICTIONAL DEMO DOCUMENT - ContractLedger AI portfolio")
    canvas.drawRightString(7.78 * inch, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()


def info_table(rows, widths=(1.55 * inch, 5.45 * inch)):
    data = [[Paragraph(str(label), styles["Label"]), Paragraph(str(value), styles["BodySmall"])] for label, value in rows]
    table = Table(data, colWidths=list(widths), hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def p(text):
    return Paragraph(text, styles["BodySmall"])


def heading(number, title):
    return Paragraph(f"{number}. {title}", styles["Section"])


def build_contract():
    path = OUTPUT / "03_Executed_Technology_Support_Services_Agreement.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, rightMargin=0.72 * inch, leftMargin=0.72 * inch, topMargin=0.66 * inch, bottomMargin=0.76 * inch, title="Executed Technology Support Services Agreement")
    story = [
        Paragraph("TECHNOLOGY SUPPORT SERVICES AGREEMENT", styles["DocTitle"]),
        Paragraph("Contract No. CT-2025-018 | Executed source copy", styles["Subtitle"]),
        Paragraph("FICTIONAL INTERVIEW DEMO - NOT A REAL AGREEMENT", styles["Demo"]),
        Spacer(1, 10),
        info_table([
            ("Customer", "Northstar Industrial Operations, Inc. (fictional)"),
            ("Supplier", "Harbor Technology Solutions Inc. (fictional)"),
            ("Effective date", "January 1, 2025"),
            ("Initial term", "January 1, 2025 through December 31, 2026"),
            ("Contract value", "$720,000 total not-to-exceed value"),
            ("Contract owner", "Selina Armstrong, Contract Administrator"),
        ]),
        heading("1", "Scope of Services"),
        p("Supplier will provide service-desk support, endpoint administration, network monitoring, cybersecurity incident coordination, scheduled maintenance, and technology asset reporting for Customer's California operations. Services include Tier 1 through Tier 3 support and coordination with approved hardware and software vendors."),
        p("Supplier will maintain a documented ticketing process and provide monthly service reports showing ticket volume, response time, resolution time, recurring incidents, corrective actions, and open risks. Work outside the agreed scope requires a written change order signed by both parties."),
        heading("2", "Service Levels"),
        info_table([
            ("Priority 1", "15-minute acknowledgment; continuous effort; target restoration within 4 hours"),
            ("Priority 2", "1-hour acknowledgment; target resolution within 1 business day"),
            ("Priority 3", "4-business-hour acknowledgment; target resolution within 3 business days"),
            ("Availability", "99.9% monthly availability for managed production services"),
        ]),
        p("If Supplier misses a monthly service level, Supplier will deliver a root-cause analysis and corrective-action plan within five business days. Repeated failure may trigger service credits or termination for cause."),
        heading("3", "Fees and Invoicing"),
        p("Customer will pay fixed monthly fees of $30,000, subject to the total not-to-exceed amount of $720,000 for the initial term. Supplier will invoice monthly in arrears and include the contract number, service month, approved reimbursable expenses, and supporting detail."),
        p("Undisputed invoices are payable Net 30 after receipt of a correct invoice. Customer may withhold disputed amounts while the parties work in good faith to resolve the dispute. Supplier may not increase rates during the initial term without a signed amendment."),
        PageBreak(),
        Paragraph("Contract No. CT-2025-018", styles["Subtitle"]),
        heading("4", "Personnel and Subcontractors"),
        p("Supplier will assign qualified personnel and remain responsible for their performance. Customer may reasonably request replacement of personnel whose conduct, qualifications, or access creates an operational or security risk. Supplier may not use a subcontractor with access to Customer systems or confidential information without prior written approval."),
        heading("5", "Information Security and Privacy"),
        p("Supplier will maintain administrative, physical, and technical safeguards consistent with generally accepted industry practices. At minimum, Supplier will use multi-factor authentication, least-privilege access, encryption in transit and at rest, endpoint protection, secure logging, vulnerability management, and annual security awareness training."),
        p("Supplier will notify Customer without undue delay and no later than 24 hours after confirming a security incident affecting Customer data or systems. Supplier will preserve relevant evidence, cooperate with investigation and remediation, and provide written updates until closure."),
        p("Customer data remains Customer property. Supplier may use Customer data only to perform this Agreement and will return or securely delete it at termination, subject to documented legal-retention requirements."),
        heading("6", "Confidentiality"),
        p("Each party will protect the other party's confidential information using at least reasonable care and will disclose it only to personnel and approved subcontractors who need it to perform this Agreement and are bound by confidentiality obligations. Confidential information excludes information independently developed, lawfully received without restriction, publicly available through no breach, or approved for release in writing."),
        heading("7", "Insurance"),
        p("During the term, Supplier will maintain commercial general liability of at least $2,000,000 aggregate, technology errors and omissions of at least $2,000,000, cyber liability of at least $2,000,000, workers compensation as required by law, and automobile liability where vehicles are used. Supplier will provide certificates of insurance upon request and notify Customer of material cancellation or reduction."),
        heading("8", "Compliance and Records"),
        p("Supplier will comply with applicable federal, state, and local laws, Customer site rules provided in writing, export controls, anti-bribery requirements, and accessibility obligations applicable to the services. Supplier will retain billing and performance records for four years after final payment and make relevant records available for reasonable audit."),
        heading("9", "Indemnification"),
        p("Supplier will defend and indemnify Customer from third-party claims arising from Supplier's negligence, willful misconduct, infringement of intellectual property rights, or breach of confidentiality or data-security obligations. Customer will promptly notify Supplier and provide reasonable cooperation. Supplier may not settle a claim in a manner that admits Customer liability or imposes non-monetary obligations on Customer without written consent."),
        PageBreak(),
        Paragraph("Contract No. CT-2025-018", styles["Subtitle"]),
        heading("10", "Limitation of Liability"),
        p("Except for excluded claims, each party's aggregate liability under this Agreement will not exceed the fees paid or payable during the twelve months preceding the event giving rise to the claim. Excluded claims include fraud, willful misconduct, confidentiality breach, data-security breach, infringement indemnity, and amounts owed for services properly performed."),
        heading("11", "Term, Renewal, and Termination"),
        p("The initial term begins January 1, 2025 and expires December 31, 2026. The Agreement automatically renews for successive one-year periods unless either party provides written notice of non-renewal at least sixty (60) days before the current term expires. For the initial term, the non-renewal notice deadline is November 1, 2026."),
        p("Either party may terminate for material breach if the breach remains uncured thirty days after written notice, or ten days for failure to pay undisputed amounts. Customer may terminate for convenience on sixty days written notice and will pay for accepted services performed through the effective termination date."),
        p("At termination, Supplier will support an orderly transition for up to ninety days at the then-current rates, return Customer property, revoke access, deliver current documentation, and certify deletion of Customer data when required."),
        heading("12", "Notices"),
        p("Formal notices must be in writing and delivered by nationally recognized overnight courier, certified mail, or confirmed electronic delivery to the contacts below. Operational communications and service tickets do not constitute legal notice."),
        info_table([
            ("Customer notices", "Legal Department, Northstar Industrial Operations, Inc., 1000 Harbor Center Drive, Oakland, CA 94607"),
            ("Supplier notices", "Contracts Department, Harbor Technology Solutions Inc., 455 Market Plaza, San Francisco, CA 94105"),
        ]),
        heading("13", "Governing Law and Disputes"),
        p("This Agreement is governed by the laws of the State of California without regard to conflict-of-law rules. Before filing suit, authorized representatives will meet in good faith to resolve the dispute. Exclusive venue for unresolved disputes will be the state or federal courts located in Alameda County, California."),
        heading("14", "General Terms"),
        p("Neither party may assign this Agreement without the other party's written consent, except to an affiliate or successor in connection with a merger or sale of substantially all relevant assets. Supplier is an independent contractor. Neither party may bind the other. Waiver must be in writing. If a provision is unenforceable, the remaining provisions remain effective."),
        p("This Agreement, its exhibits, approved statements of work, and signed amendments are the complete agreement concerning the services and supersede prior proposals and discussions. Conflicting purchase-order terms are rejected. Amendments must be signed by authorized representatives of both parties."),
        PageBreak(),
        Paragraph("Contract No. CT-2025-018 | Signature page", styles["Subtitle"]),
        p("The parties have caused this Agreement to be executed by their authorized representatives. Electronic and counterpart signatures are effective as originals."),
        Spacer(1, 18),
        Table([
            [Paragraph("NORTHSTAR INDUSTRIAL OPERATIONS, INC.", styles["Label"]), Paragraph("HARBOR TECHNOLOGY SOLUTIONS INC.", styles["Label"])],
            [Paragraph("/s/ Elena Martinez", styles["BodySmall"]), Paragraph("/s/ Christopher Allen", styles["BodySmall"])],
            [Paragraph("Elena Martinez<br/>Vice President, Operations<br/>Date: December 18, 2024", styles["BodySmall"]), Paragraph("Christopher Allen<br/>President<br/>Date: December 19, 2024", styles["BodySmall"])],
        ], colWidths=[3.45 * inch, 3.45 * inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("BACKGROUND", (0, 0), (-1, 0), PALE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])),
        Spacer(1, 20),
        Paragraph("EXHIBIT A - SERVICE GOVERNANCE", styles["Section"]),
        p("The parties will hold a monthly operations review and a quarterly executive review. Supplier will provide the monthly report at least three business days before the operations review. Escalations will move from the service delivery manager to the account executive and then to the executive sponsors."),
        info_table([
            ("Monthly report", "Service levels, ticket trends, changes, incidents, risks, planned maintenance, asset status"),
            ("Quarterly review", "Performance, roadmap, security posture, financial status, improvement plan"),
            ("Change control", "Written request, impact assessment, approval, implementation plan, closure evidence"),
            ("Renewal review", "Internal review starts October 1, 2026; notice deadline November 1, 2026"),
        ]),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


def build_w9():
    path = OUTPUT / "04_Harbor_Technology_Demo_W9.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, rightMargin=0.72 * inch, leftMargin=0.72 * inch, topMargin=0.65 * inch, bottomMargin=0.76 * inch, title="Demo W-9 Supplier Tax Record")
    story = [
        Paragraph("SUPPLIER TAX RECORD - W-9 DEMO", styles["DocTitle"]),
        Paragraph("Fictional onboarding document for ContractLedger AI", styles["Subtitle"]),
        Paragraph("DEMO ONLY - NOT AN IRS FORM AND NOT VALID FOR TAX REPORTING", styles["Demo"]),
        Spacer(1, 12),
        info_table([
            ("Legal name", "Harbor Technology Solutions Inc."),
            ("Business name", "Harbor Technology Solutions"),
            ("Federal tax classification", "C Corporation"),
            ("Exempt payee code", "None"),
            ("FATCA reporting exemption", "Not applicable"),
            ("Address", "455 Market Plaza, San Francisco, CA 94105"),
            ("Taxpayer ID", "XX-XXX6789 (masked fictional value)"),
            ("Supplier record", "sup-harbor"),
        ]),
        Paragraph("Certification", styles["Section"]),
        p("The authorized representative certifies for this fictional demonstration that the name and tax classification shown above match the supplier onboarding record, that the masked identifier is presented only to demonstrate secure data handling, and that this document contains no real taxpayer information."),
        Spacer(1, 14),
        Table([
            [Paragraph("Authorized signature", styles["Label"]), Paragraph("/s/ Christopher Allen", styles["BodySmall"])],
            [Paragraph("Name and title", styles["Label"]), Paragraph("Christopher Allen, President", styles["BodySmall"])],
            [Paragraph("Certification date", styles["Label"]), Paragraph("December 15, 2024", styles["BodySmall"])],
            [Paragraph("Received by", styles["Label"]), Paragraph("Northstar Procurement Operations (fictional)", styles["BodySmall"])],
        ], colWidths=[1.55 * inch, 5.45 * inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("BACKGROUND", (0, 0), (0, -1), PALE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])),
        Spacer(1, 18),
        Paragraph("Portfolio note", styles["Section"]),
        p("A production system would restrict access to tax documents, encrypt sensitive identifiers, log every view and download, apply retention rules, and avoid exposing taxpayer information in general search results. ContractLedger AI stores only this fictional masked example."),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


def build_coi():
    path = OUTPUT / "05_Harbor_Technology_Demo_Insurance_Certificate.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, rightMargin=0.62 * inch, leftMargin=0.62 * inch, topMargin=0.55 * inch, bottomMargin=0.76 * inch, title="Demo Certificate of Liability Insurance")
    coverage = [
        [Paragraph("Coverage", styles["WhiteLabel"]), Paragraph("Policy number", styles["WhiteLabel"]), Paragraph("Effective", styles["WhiteLabel"]), Paragraph("Expires", styles["WhiteLabel"]), Paragraph("Limit", styles["WhiteLabel"])],
        [p("Commercial General Liability"), p("CGL-DEMO-48120"), p("02/01/2026"), p("01/31/2027"), p("$2,000,000 aggregate")],
        [p("Technology E&O"), p("TECH-DEMO-78119"), p("02/01/2026"), p("01/31/2027"), p("$2,000,000 each claim")],
        [p("Cyber Liability"), p("CYB-DEMO-22874"), p("02/01/2026"), p("01/31/2027"), p("$2,000,000 aggregate")],
        [p("Workers Compensation"), p("WC-DEMO-10482"), p("02/01/2026"), p("01/31/2027"), p("Statutory")],
    ]
    table = Table(coverage, colWidths=[1.62 * inch, 1.42 * inch, 0.92 * inch, 0.92 * inch, 1.42 * inch], repeatRows=1)
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
            ("Producer", "Bayview Risk Services, License DEMO-0001 (fictional)"),
            ("Insured", "Harbor Technology Solutions Inc., 455 Market Plaza, San Francisco, CA 94105"),
            ("Certificate holder", "Northstar Industrial Operations, Inc., 1000 Harbor Center Drive, Oakland, CA 94607"),
            ("Certificate date", "January 20, 2026"),
        ], widths=(1.45 * inch, 5.65 * inch)),
        Paragraph("Coverage summary", styles["Section"]),
        table,
        Paragraph("Description of operations", styles["Section"]),
        p("Evidence of fictional coverage for technology support services under Contract CT-2025-018. Northstar Industrial Operations, Inc. is shown as an additional insured for commercial general liability where required by written contract. Waiver of subrogation applies where required by written contract."),
        Paragraph("Cancellation notice", styles["Section"]),
        p("For this demonstration, the certificate record requires follow-up before January 31, 2027. A production workflow would verify policy terms directly with the carrier and track replacement documentation before expiration."),
        Spacer(1, 14),
        KeepTogether([
            Paragraph("Authorized representative", styles["Label"]),
            Spacer(1, 8),
            Paragraph("/s/ Morgan Rivera - Bayview Risk Services (fictional)", styles["BodySmall"]),
        ]),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


if __name__ == "__main__":
    for generated in (build_contract(), build_w9(), build_coi()):
        print(generated)
