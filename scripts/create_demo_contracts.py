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

NAVY = colors.HexColor("#15384B")
INK = colors.HexColor("#263843")
MUTED = colors.HexColor("#5A6D78")
LINE = colors.HexColor("#CBD9DF")
PALE = colors.HexColor("#EEF5F7")
DEMO = colors.HexColor("#A54832")

base = getSampleStyleSheet()
TITLE = ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8)
SUBTITLE = ParagraphStyle("Subtitle", parent=base["BodyText"], fontSize=10, leading=14, textColor=MUTED, alignment=TA_CENTER, spaceAfter=14)
DEMO_STYLE = ParagraphStyle("Demo", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=DEMO, alignment=TA_CENTER, spaceAfter=14)
PAGE_TITLE = ParagraphStyle("PageTitle", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=NAVY, spaceAfter=11)
HEADING = ParagraphStyle("Heading", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=NAVY, spaceBefore=8, spaceAfter=3)
BODY = ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica", fontSize=8.25, leading=11.9, textColor=INK, spaceAfter=6)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=7.3, leading=9.8, textColor=MUTED)


def para(text, style=BODY):
    return Paragraph(text, style)


def clause(number, title, text):
    return [Paragraph(f"{number}. {title}", HEADING), Paragraph(text, BODY)]


def metadata(rows):
    table = Table([[para(a, SMALL), para(b, SMALL)] for a, b in rows], colWidths=[1.65 * inch, 4.95 * inch], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def grid(headers, rows, widths):
    cells = [[para(x, SMALL) for x in headers]] + [[para(x, SMALL) for x in row] for row in rows]
    table = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFB")]),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def footer_for(status, number):
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(0.72 * inch, 0.62 * inch, 7.78 * inch, 0.62 * inch)
        canvas.setFont("Helvetica", 7.2)
        canvas.setFillColor(MUTED)
        canvas.drawString(0.72 * inch, 0.42 * inch, f"{number} | {status} | FICTIONAL PORTFOLIO DEMO")
        canvas.drawRightString(7.78 * inch, 0.42 * inch, f"Page {doc.page}")
        canvas.restoreState()
    return footer


def build(path, title, status, number, cover_rows, pages):
    doc = SimpleDocTemplate(
        str(path), pagesize=letter, rightMargin=0.72 * inch, leftMargin=0.72 * inch,
        topMargin=0.68 * inch, bottomMargin=0.82 * inch, title=title,
        author="ContractLedger AI Portfolio Demo",
        subject="Fictional U.S. professional services agreement for AI extraction",
    )
    story = [
        Spacer(1, 0.48 * inch),
        Paragraph(title.upper(), TITLE),
        Paragraph("Plant Modernization Engineering Support", SUBTITLE),
        Paragraph("FICTIONAL DOCUMENT - CREATED ONLY FOR PORTFOLIO DEMONSTRATION", DEMO_STYLE),
        metadata(cover_rows),
        Spacer(1, 17),
        para("This document and all organizations, people, addresses, signatures, values, and projects are fictional. It demonstrates AI-assisted contract administration, source traceability, supplier matching, register automation, and renewal tracking. It is not legal advice and is not intended for execution.", SMALL),
    ]
    for page_title, elements in pages:
        story.extend([PageBreak(), Paragraph(page_title, PAGE_TITLE), *elements])
    footer = footer_for(status, number)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def clause_page(items):
    output = []
    for item in items:
        output.extend(clause(*item))
    return output


DRAFT_PAGES = [
    ("Agreement Overview and Draft Contents", [
        para("This Draft Professional Services Agreement is submitted for Northstar review and has not been approved or executed. Proposed commercial terms remain outside the official contract register."),
        metadata([
            ["Customer", "Northstar Industrial Services, Inc."],
            ["Proposed Supplier", "Westline Engineering Group LLC"],
            ["Project", "Plant Modernization Engineering Support"],
            ["Draft Reference", "DRAFT-PSA-2026-118"],
            ["Proposed Value", "USD 585,000"],
            ["Proposed Term", "October 1, 2026 through September 30, 2027"],
        ]),
        Spacer(1, 10),
        Paragraph("Contract structure", HEADING),
        para("1. Parties, recitals, definitions, and order of precedence<br/>2. Services, key personnel, subcontractors, and change control<br/>3. Fees, invoicing, taxes, expenses, and audit rights<br/>4. Term, automatic renewal, suspension, and termination<br/>5. Confidentiality, data security, and records handling<br/>6. Intellectual property, compliance, and publicity<br/>7. Insurance, indemnification, and limitation of liability<br/>8. General terms, governing law, assignment, and notices<br/>Exhibit A. Scope, deliverables, milestones, and pricing"),
        para("DRAFT CONTROL NOTE: Northstar Procurement must confirm supplier onboarding, business ownership, funding, CFO approval, insurance, legal review, and signature authority before execution.", DEMO_STYLE),
    ]),
    ("1. Parties, Recitals, and Definitions", clause_page([
        ("1.1", "Parties", "This Draft Professional Services Agreement (the <b>Agreement</b>) is proposed between <b>Northstar Industrial Services, Inc.</b>, a Delaware corporation with offices at 420 Harbor Industrial Way, Oakland, California 94607 (<b>Northstar</b>), and <b>Westline Engineering Group LLC</b>, a New York limited liability company with offices at 88 Madison Works Plaza, Albany, New York 12207 (<b>Supplier</b>)."),
        ("1.2", "Purpose", "Northstar is planning a modernization program at its fictional Oakland processing facility. Supplier proposes to provide engineering assessment, project-controls coordination, equipment-layout review, and commissioning support as described in Exhibit A."),
        ("1.3", "Definitions", "<b>Confidential Information</b> means non-public commercial, technical, security, pricing, personnel, and operational information. <b>Deliverables</b> means reports, drawings, schedules, models, and other work product identified in Exhibit A. <b>Services</b> means the professional services described in an executed Statement of Work."),
        ("1.4", "Order of Precedence", "In a conflict, the order of precedence will be: an executed change order, the applicable Statement of Work, this Agreement, and Supplier's proposal. Supplier's invoice terms or online terms will not amend the Agreement."),
        ("1.5", "Independent Contractor", "Supplier is an independent contractor with no authority to bind Northstar. Supplier is responsible for the direction, compensation, taxes, and supervision of its personnel."),
    ])),
    ("2. Services, Personnel, and Change Control", clause_page([
        ("2.1", "Performance Standard", "Supplier will perform the Services professionally and consistently with generally accepted engineering practices and Exhibit A. Supplier will promptly notify Northstar of conditions reasonably expected to affect cost, schedule, safety, or deliverable quality."),
        ("2.2", "Key Personnel", "Daniel Ortiz will serve as Supplier project manager. Supplier may replace key personnel with individuals of substantially similar experience after providing written notice to Northstar."),
        ("2.3", "Subcontractors", "Supplier may engage qualified subcontractors to perform portions of the Services <b>without Northstar's prior consent</b>. Supplier remains responsible for subcontractor performance and payment."),
        ("2.4", "Site Rules", "Personnel entering a Northstar site must comply with posted safety, security, access-control, and incident-reporting rules. Northstar may remove personnel presenting a reasonable safety or security concern."),
        ("2.5", "Change Control", "Either party may request changes to scope, assumptions, schedule, staffing, or fees. Supplier may begin additional work based on <b>email authorization</b> from Northstar's project manager, and the parties will document the change within thirty days."),
        ("2.6", "Acceptance", "Northstar will review each Deliverable within ten business days. A Deliverable is deemed accepted if Northstar does not provide written notice of material nonconformity during that period."),
    ])),
    ("3. Fees, Invoicing, Taxes, and Records", clause_page([
        ("3.1", "Proposed Contract Value", "The total not-to-exceed value is <b>USD 585,000</b>, consisting of USD 545,000 in professional fees and USD 40,000 in expenses. Supplier may exceed that value based on email authorization pending a formal change order."),
        ("3.2", "Invoices", "Supplier will invoice monthly in arrears and identify personnel, hours, rates, expenses, milestone progress, purchase-order number, and Statement of Work. Northstar may withhold only the disputed portion."),
        ("3.3", "Payment Terms", "Northstar will pay undisputed amounts within <b>sixty (60) days</b> after receiving a complete and accurate invoice. Past-due amounts accrue interest at one percent per month or the maximum lawful rate."),
        ("3.4", "Expenses", "Northstar will reimburse reasonable travel expenses at actual cost, including airfare, lodging, meals, and mileage. Only individual expenses above USD 2,500 require advance approval."),
        ("3.5", "Taxes", "Fees exclude sales, use, excise, and similar transaction taxes. Northstar is not responsible for taxes based on Supplier's income, payroll, property, or personnel."),
        ("3.6", "Records", "Supplier will maintain invoice-supporting records for two years after final payment. Any review is limited to once per year and conducted by Supplier's independent accountant at Northstar's expense."),
    ])),
    ("4. Term, Renewal, Suspension, and Termination", clause_page([
        ("4.1", "Proposed Term", "The proposed term begins <b>October 1, 2026</b> and expires <b>September 30, 2027</b>, unless earlier terminated under the Agreement."),
        ("4.2", "Automatic Renewal", "The Agreement will <b>automatically renew</b> for successive twelve-month terms unless either party gives written notice at least <b>forty-five (45) days</b> before the end of the current term."),
        ("4.3", "Termination for Cause", "Either party may terminate for material breach if the breach remains uncured thirty days after written notice. Supplier may suspend Services on ten days' notice for an undisputed invoice unpaid more than thirty days after its due date."),
        ("4.4", "Termination for Convenience", "Supplier may terminate for convenience on sixty days' notice. Northstar may do so only if it pays an early termination charge equal to fifteen percent of the remaining not-to-exceed value."),
        ("4.5", "Closeout", "At expiration or termination, Supplier will stop work, deliver completed and in-process Deliverables, return Northstar property, and submit a final invoice within sixty days."),
        ("4.6", "Transition Assistance", "At Northstar's request, Supplier will provide up to forty hours of transition assistance at the rates in Exhibit A."),
    ])),
    ("5. Confidentiality and Data Security", clause_page([
        ("5.1", "Confidentiality", "Each receiving party will use Confidential Information only for the Services and protect it using reasonable care. Obligations continue for three years after disclosure; trade-secret obligations continue while information remains a trade secret."),
        ("5.2", "Exclusions", "Confidential Information excludes information independently developed, rightfully received without restriction, publicly available through no breach, or approved for release in writing."),
        ("5.3", "Required Disclosure", "A receiving party may disclose information when legally required after advance notice where lawful and reasonable assistance at the disclosing party's expense."),
        ("5.4", "Security Program", "Supplier will maintain commercially reasonable safeguards and may store project files in its standard U.S.-hosted collaboration platform."),
        ("5.5", "Security Incident", "Supplier will notify Northstar no later than <b>ten (10) business days</b> after confirming unauthorized access to Northstar Confidential Information and will describe available corrective action."),
        ("5.6", "Return and Deletion", "After termination and written request, each party will return or delete the other's information, except routine backup and legal-retention copies."),
    ])),
    ("6. Intellectual Property and Compliance", clause_page([
        ("6.1", "Background Materials", "Each party retains ownership of technology, methods, templates, know-how, documentation, and materials developed independently of this Agreement."),
        ("6.2", "Deliverable Ownership", "Supplier owns all Deliverables and project work product. Upon full payment, Supplier grants Northstar a perpetual, non-exclusive, <b>non-transferable license</b> to use final Deliverables only at the Oakland facility."),
        ("6.3", "Third-Party Materials", "Supplier may incorporate third-party tools, standards, and materials into Deliverables, subject to their applicable license terms."),
        ("6.4", "Compliance with Laws", "Each party will comply with laws applicable to its own performance. Supplier will comply with anti-bribery, export-control, equal-employment, and workplace-safety requirements."),
        ("6.5", "No Debarment", "Supplier represents it is not suspended or debarred from U.S. federal contracting and will notify Northstar of a material change."),
        ("6.6", "Publicity", "Supplier may identify Northstar as a customer and use Northstar's name in a customer list unless Northstar objects in writing."),
    ])),
    ("7. Insurance, Indemnification, and Liability", clause_page([
        ("7.1", "Insurance", "Supplier will maintain workers' compensation as required by law and commercial general liability insurance of <b>USD 1,000,000 per occurrence</b>. A certificate of insurance is provided only upon written request."),
        ("7.2", "Supplier Indemnity", "Supplier will defend and indemnify Northstar only against a third-party claim that a final Deliverable directly infringes a U.S. patent, copyright, or trademark."),
        ("7.3", "Northstar Indemnity", "Northstar will defend and indemnify Supplier from claims arising from unsafe site conditions or Northstar instructions, except to the extent caused by Supplier negligence."),
        ("7.4", "Liability Cap", "Supplier's aggregate liability will not exceed <b>twenty-five percent (25%) of fees paid</b> during the six months preceding the event. The cap applies to confidentiality and indemnity obligations."),
        ("7.5", "Excluded Damages", "Neither party is liable for lost profit, production, data, business interruption, or indirect, incidental, special, exemplary, or consequential damages."),
        ("7.6", "Professional Judgment", "Supplier does not warrant governmental approval, project outcome, energy savings, or construction results dependent on third parties."),
    ])),
    ("8. General Terms and Exhibit A", [
        *clause_page([
            ("8.1", "Governing Law and Venue", "The Agreement is governed by the laws of the <b>State of New York</b>. Exclusive venue lies in state or federal courts in Albany County, New York."),
            ("8.2", "Assignment", "Supplier may assign to an Affiliate or in connection with a merger or asset sale upon notice. Other assignments require consent."),
            ("8.3", "Notices", "Legal notices go to Northstar Legal Department, Oakland, California, at legal-notices@northstar-demo.example, and Supplier Managing Member, Albany, New York, at contracts@westline-demo.example."),
            ("8.4", "Force Majeure and Entire Agreement", "Neither party is liable for delay beyond reasonable control. The executed Agreement and exhibits will supersede prior proposals. Amendments must be signed by authorized representatives."),
        ]),
        Paragraph("Exhibit A - Proposed deliverables and pricing", HEADING),
        grid(["Deliverable", "Proposed due date", "Acceptance evidence"], [
            ["Existing-condition assessment", "November 15, 2026", "Report and photo log"],
            ["30% layout and risk review", "January 31, 2027", "Drawings and risk register"],
            ["90% coordination package", "April 30, 2027", "Marked drawings and action log"],
            ["Commissioning and closeout", "September 15, 2027", "Punch list and closeout memorandum"],
        ], [2.45 * inch, 1.35 * inch, 2.8 * inch]),
        Spacer(1, 7),
        grid(["Role / item", "Rate or amount", "Budget"], [
            ["Principal engineer", "USD 285/hour", "USD 171,000"],
            ["Senior project engineer", "USD 225/hour", "USD 225,000"],
            ["Project controls specialist", "USD 185/hour", "USD 149,000"],
            ["Expenses", "At cost", "USD 40,000"],
            ["Total not-to-exceed", "", "USD 585,000"],
        ], [2.8 * inch, 1.6 * inch, 2.2 * inch]),
        para("DRAFT STATUS: Signature blocks are intentionally omitted. Values above USD 500,000 require CFO approval under the fictional company playbook.", DEMO_STYLE),
    ]),
]


EXECUTED_PAGES = [
    ("Agreement Overview and Executed Contents", [
        para("This executed Professional Services Agreement is the final source of truth for contract registration. It supersedes draft DRAFT-PSA-2026-118 and incorporates negotiated commercial, risk, and operational changes."),
        metadata([
            ["Customer", "Northstar Industrial Services, Inc."],
            ["Supplier", "Westline Engineering Group LLC"],
            ["Project", "Plant Modernization Engineering Support"],
            ["Contract Number", "PSA-2026-118"],
            ["Executed Value", "USD 475,000"],
            ["Effective / Expiration", "October 15, 2026 / October 14, 2027"],
        ]),
        Spacer(1, 10),
        Paragraph("Final contract structure", HEADING),
        para("1. Parties, recitals, definitions, and order of precedence<br/>2. Services, key personnel, subcontractors, and change control<br/>3. Fees, invoicing, taxes, expenses, and audit rights<br/>4. Term, renewal, suspension, termination, and closeout<br/>5. Confidentiality, data security, data location, and deletion<br/>6. Intellectual property, compliance, and publicity<br/>7. Insurance, indemnification, and limitation of liability<br/>8. General terms, governing law, assignment, and notices<br/>Exhibit A. Final scope, deliverables, pricing, and obligations<br/>Execution and contract-administration handoff"),
        para("REGISTER CONTROL NOTE: Human verification of this signed version authorizes creation of the official contract record, activation of the matched supplier, and renewal-date monitoring.", DEMO_STYLE),
    ]),
    ("1. Parties, Recitals, and Definitions", clause_page([
        ("1.1", "Parties", "This Professional Services Agreement (the <b>Agreement</b>) is entered into by <b>Northstar Industrial Services, Inc.</b>, a Delaware corporation with offices at 420 Harbor Industrial Way, Oakland, California 94607 (<b>Northstar</b>), and <b>Westline Engineering Group LLC</b>, a New York limited liability company with offices at 88 Madison Works Plaza, Albany, New York 12207 (<b>Supplier</b>)."),
        ("1.2", "Purpose", "Northstar is undertaking a modernization program at its fictional Oakland processing facility. Supplier will provide engineering assessment, project-controls coordination, equipment-layout review, and commissioning support under Exhibit A."),
        ("1.3", "Definitions", "<b>Confidential Information</b> means non-public commercial, technical, security, pricing, personnel, and operational information. <b>Deliverables</b> means reports, drawings, schedules, models, and work product identified in Exhibit A. <b>Services</b> means the professional services described in Exhibit A."),
        ("1.4", "Order of Precedence", "In a conflict, the order of precedence is: a signed change order, Exhibit A, this Agreement, and Supplier's proposal. Purchase-order, invoice, and online terms do not amend this Agreement."),
        ("1.5", "Independent Contractor", "Supplier is an independent contractor with no authority to bind Northstar and is responsible for the direction, compensation, taxes, and supervision of its personnel."),
    ])),
    ("2. Services, Personnel, and Change Control", clause_page([
        ("2.1", "Performance Standard", "Supplier will perform professionally and consistently with generally accepted engineering practices and Exhibit A. Supplier will promptly notify Northstar of conditions reasonably expected to affect cost, schedule, safety, or quality."),
        ("2.2", "Key Personnel", "Daniel Ortiz will serve as Supplier project manager. Supplier will not replace key personnel without Northstar's prior written approval, which will not be unreasonably withheld."),
        ("2.3", "Subcontractors", "Supplier may not engage a subcontractor to access a Northstar site, system, or information without <b>Northstar's prior written consent</b>. Supplier remains responsible for subcontractor acts, omissions, security, compliance, and payment."),
        ("2.4", "Site Rules", "Personnel entering a Northstar site must complete safety orientation and comply with safety, security, access-control, and incident-reporting rules. Northstar may remove personnel presenting a reasonable concern."),
        ("2.5", "Change Control", "No change to scope, schedule, staffing, assumptions, or fees is effective unless documented in a written change order signed by authorized representatives. Supplier will not begin out-of-scope work before the signed change order."),
        ("2.6", "Acceptance", "Northstar will review each Deliverable within ten business days and accept it or identify material nonconformities. Supplier will correct documented nonconformities without additional charge. Silence is not acceptance."),
    ])),
    ("3. Fees, Invoicing, Taxes, and Audit", clause_page([
        ("3.1", "Contract Value", "The total not-to-exceed value is <b>USD 475,000</b>, consisting of USD 450,000 in professional fees and USD 25,000 in pre-approved expenses. No amount above USD 475,000 is payable without a signed amendment."),
        ("3.2", "Invoices", "Supplier will invoice monthly in arrears and identify personnel, hours, rates, expenses, milestone progress, contract number PSA-2026-118, and purchase-order number. Northstar may withhold disputed amounts while paying undisputed amounts."),
        ("3.3", "Payment Terms", "Northstar will pay undisputed amounts within <b>thirty (30) days</b> after receiving a complete and accurate invoice through its designated accounts-payable channel."),
        ("3.4", "Expenses", "Travel must be approved in writing before booking and comply with Northstar's supplier travel policy. Expenses are reimbursed at actual cost without markup and require receipts."),
        ("3.5", "Taxes", "Fees exclude applicable sales and use taxes separately stated on a valid invoice. Northstar is not responsible for Supplier income, payroll, property, or personnel taxes."),
        ("3.6", "Records and Audit", "Supplier will maintain invoice, time, expense, subcontractor, and compliance records for <b>four years</b> after final payment. Northstar may audit relevant records on ten business days' notice."),
    ])),
    ("4. Term, Renewal, Termination, and Closeout", clause_page([
        ("4.1", "Initial Term", "The Agreement is effective <b>October 15, 2026</b> and expires <b>October 14, 2027</b>, unless earlier terminated under this Agreement."),
        ("4.2", "Automatic Renewal", "The Agreement will <b>automatically renew</b> for one additional twelve-month term unless either party gives written notice at least <b>sixty (60) days</b> before October 14, 2027. The calculated notice deadline is <b>August 15, 2027</b>."),
        ("4.3", "Termination for Cause", "Either party may terminate for material breach remaining uncured thirty days after notice. A material confidentiality, data-security, fraud, bribery, or safety breach may be terminated immediately when cure is not reasonably possible."),
        ("4.4", "Termination for Convenience", "Northstar may terminate all or part of the Agreement for convenience on <b>thirty (30) days'</b> notice without an early termination charge. Northstar will pay accepted Services through termination and approved non-cancelable commitments."),
        ("4.5", "Closeout", "At expiration or termination, Supplier will stop affected work, protect the site, deliver completed and in-process Deliverables, return Northstar property, and submit a final invoice within <b>forty-five (45) days</b>."),
        ("4.6", "Transition Assistance", "At Northstar's request, Supplier will provide up to forty hours of transition assistance at Exhibit A rates, within the not-to-exceed value."),
    ])),
    ("5. Confidentiality and Data Security", clause_page([
        ("5.1", "Confidentiality", "Each receiving party will use Confidential Information only for the Services and protect it with at least reasonable care. Obligations continue for five years; trade-secret obligations continue while information remains a trade secret."),
        ("5.2", "Exclusions and Required Disclosure", "Confidential Information excludes independently developed, rightfully received, public, or approved information. Legally required disclosure is permitted after advance notice where lawful."),
        ("5.3", "Security Program", "Supplier will maintain written safeguards aligned to recognized practices, including access control, multi-factor authentication, encryption in transit, vulnerability management, training, and secure disposal."),
        ("5.4", "Security Incident", "Supplier will notify security@northstar-demo.example without undue delay and no later than <b>seventy-two (72) hours</b> after discovering unauthorized access, preserve evidence, investigate, mitigate, and provide updates."),
        ("5.5", "Data Location and Subprocessors", "Supplier will store project data in the United States and will not engage a subprocessor with access without prior written approval and equivalent contractual protections."),
        ("5.6", "Return and Deletion", "Within thirty days after request or termination, Supplier will return or securely delete Northstar information and certify deletion, except copies retained solely to satisfy law."),
    ])),
    ("6. Intellectual Property and Compliance", clause_page([
        ("6.1", "Background Materials", "Each party retains ownership of technology, methods, templates, know-how, documentation, and materials developed independently of this Agreement."),
        ("6.2", "Deliverable Ownership", "Upon creation and payment, <b>Northstar owns all project-specific Deliverables</b>, including drawings, schedules, calculations, reports, and configuration records. Supplier assigns all right, title, and interest."),
        ("6.3", "Embedded Supplier Materials", "Supplier retains pre-existing tools embedded in a Deliverable and grants Northstar a perpetual, worldwide, royalty-free, transferable license to use, reproduce, modify, and maintain them with the Deliverable."),
        ("6.4", "Compliance with Laws", "Supplier will comply with anti-bribery, export-control, sanctions, equal-employment, environmental, wage-and-hour, and workplace-safety requirements and the Northstar Supplier Code of Conduct."),
        ("6.5", "No Debarment", "Supplier represents it is not suspended or debarred from U.S. federal contracting and will notify Northstar within five business days of a material change."),
        ("6.6", "Publicity", "Supplier may not use Northstar's name, trademarks, project images, or relationship in publicity, case studies, customer lists, or social media without prior written approval."),
    ])),
    ("7. Insurance, Indemnification, and Liability", clause_page([
        ("7.1", "Insurance", "Before site access and throughout the term, Supplier will maintain workers' compensation; employers' liability of USD 1,000,000; commercial general liability of <b>USD 2,000,000 per occurrence and USD 4,000,000 aggregate</b>; auto liability of USD 1,000,000; professional liability of USD 2,000,000; and cyber liability of USD 1,000,000."),
        ("7.2", "Insurance Evidence", "Supplier will deliver a current certificate of insurance no later than <b>October 10, 2026</b>. Northstar will be an additional insured where commercially available."),
        ("7.3", "Supplier Indemnity", "Supplier will defend, indemnify, and hold harmless Northstar from third-party claims arising from bodily injury, property damage, Supplier negligence or willful misconduct, violation of law, or Deliverable infringement."),
        ("7.4", "Liability Cap", "Except for fraud, willful misconduct, gross negligence, confidentiality or data-security breach, indemnity, or infringement, each party's liability will not exceed <b>total fees paid or payable</b>. Excluded claims are uncapped."),
        ("7.5", "Excluded Damages", "Except for excluded claims, neither party is liable for indirect, incidental, special, exemplary, punitive, or consequential damages. Direct security remediation, notification, and restoration costs are not excluded."),
    ])),
    ("8. General Terms and Notices", clause_page([
        ("8.1", "Governing Law and Venue", "The Agreement is governed by the laws of the <b>State of California</b>. Exclusive venue lies in state or federal courts in Alameda County, California."),
        ("8.2", "Assignment", "Neither party may assign without prior written consent, except Northstar may assign to an Affiliate or with a merger, reorganization, or facility transfer. A prohibited assignment is void."),
        ("8.3", "Notices", "Legal notices go by overnight courier and email to Northstar Legal Department, Oakland, California, legal-notices@northstar-demo.example, and Supplier Managing Member, Albany, New York, contracts@westline-demo.example."),
        ("8.4", "Force Majeure", "Neither party is liable for delay beyond reasonable control, excluding payment, controllable labor shortages, and avoidable subcontractor delay. The affected party will notify and mitigate."),
        ("8.5", "Dispute Escalation", "Project managers will attempt resolution for ten business days, followed by executive escalation for ten business days. Emergency equitable relief is not delayed."),
        ("8.6", "Entire Agreement", "This Agreement and Exhibit A supersede DRAFT-PSA-2026-118, proposals, and prior communications. Amendments must be signed by authorized representatives."),
        ("8.7", "Counterparts and Electronic Signatures", "The Agreement may be executed in counterparts and by electronic signature, each deemed an original and together one instrument."),
    ])),
    ("Exhibit A - Scope and Deliverables", [
        para("<b>Project:</b> Plant Modernization Engineering Support<br/><b>Northstar project owner:</b> Maya Chen, Director of Capital Projects<br/><b>Supplier project manager:</b> Daniel Ortiz<br/><b>Work location:</b> Oakland, California, with approved remote work"),
        Paragraph("A.1 Scope", HEADING),
        para("Supplier will assess existing conditions, coordinate design interfaces, maintain project risk and action logs, support equipment-layout reviews, attend biweekly coordination meetings, and provide commissioning and closeout support. Construction means and methods remain the responsibility of Northstar's construction contractors."),
        Paragraph("A.2 Final deliverables", HEADING),
        grid(["Deliverable", "Due date", "Acceptance criteria"], [
            ["Existing-condition assessment", "November 15, 2026", "Report, photo log, and prioritized constraints"],
            ["30% layout and risk review", "January 31, 2027", "Drawings, risk register, and comments log"],
            ["90% coordination package", "April 30, 2027", "Marked drawings, interface matrix, and action closeout"],
            ["Commissioning and closeout", "September 15, 2027", "Punch list, turnover index, and final memorandum"],
        ], [2.3 * inch, 1.25 * inch, 3.05 * inch]),
        *clause_page([
            ("A.3", "Acceptance Procedure", "Northstar will review submissions within ten business days. Supplier will correct material nonconformities within five business days or an agreed schedule. Acceptance does not waive latent defects."),
            ("A.4", "Dependencies", "Northstar will provide facility access, drawings, equipment data, safety orientation, and consolidated comments. Supplier will document a claimed dependency delay within three business days."),
        ]),
    ]),
    ("Exhibit A - Pricing and Administrative Obligations", [
        Paragraph("A.5 Pricing schedule", HEADING),
        grid(["Role / item", "Rate or basis", "Authorized budget"], [
            ["Principal engineer", "USD 275/hour", "USD 137,500"],
            ["Senior project engineer", "USD 215/hour", "USD 193,500"],
            ["Project controls specialist", "USD 175/hour", "USD 119,000"],
            ["Pre-approved expenses", "At cost; no markup", "USD 25,000"],
            ["Total not-to-exceed", "", "USD 475,000"],
        ], [2.7 * inch, 1.7 * inch, 2.2 * inch]),
        Paragraph("A.6 Administrative obligations", HEADING),
        grid(["Obligation", "Owner", "Due / frequency"], [
            ["Certificate of insurance", "Supplier", "October 10, 2026; maintain current"],
            ["W-9 and onboarding packet", "Supplier", "Before first invoice"],
            ["Progress and risk report", "Supplier", "Fifth business day monthly"],
            ["Detailed invoice", "Supplier", "Monthly in arrears"],
            ["Internal renewal review", "Northstar", "July 16, 2027"],
            ["Non-renewal notice", "Either party", "No later than August 15, 2027"],
            ["Final invoice and closeout", "Supplier", "Within 45 days after end"],
        ], [3.2 * inch, 1.2 * inch, 2.2 * inch]),
        *clause_page([("A.7", "Governance", "Project managers may coordinate daily work but may not amend value, legal terms, insurance, renewal, or schedule obligations. Amendments require Procurement review and authorized signatures.")]),
    ]),
    ("Execution and Contract Administration Handoff", [
        para("The parties caused this Agreement to be executed by their duly authorized representatives. Electronic signatures are effective as originals."),
        Spacer(1, 20),
        Table([
            [para("<b>NORTHSTAR INDUSTRIAL SERVICES, INC.</b>", SMALL), para("<b>WESTLINE ENGINEERING GROUP LLC</b>", SMALL)],
            [para("/s/ Jordan Ellis"), para("/s/ Morgan Reyes")],
            [para("Jordan Ellis, Vice President, Operations", SMALL), para("Morgan Reyes, Managing Member", SMALL)],
            [para("Date: October 10, 2026", SMALL), para("Date: October 10, 2026", SMALL)],
        ], colWidths=[3.3 * inch, 3.3 * inch], style=[
            ("LINEABOVE", (0, 1), (-1, 1), 0.7, colors.HexColor("#8396A0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]),
        Spacer(1, 20),
        Paragraph("Contract administration handoff", HEADING),
        metadata([
            ["Official contract number", "PSA-2026-118"],
            ["Supplier match", "Westline Engineering Group LLC - activate pending supplier"],
            ["Department / owner", "Capital Projects / Maya Chen"],
            ["Current contract value", "USD 475,000"],
            ["Renewal type", "Automatic - one additional 12-month term"],
            ["Internal renewal review", "July 16, 2027"],
            ["Non-renewal notice deadline", "August 15, 2027"],
            ["Supplier documents", "W-9 and current certificate of insurance"],
        ]),
        Spacer(1, 12),
        para("All names, organizations, addresses, signatures, values, and terms are fictional. This sample exists only to demonstrate AI-assisted contract administration.", DEMO_STYLE),
    ]),
]


build(
    OUTPUT / "01_Draft_Professional_Services_Agreement.pdf",
    "Draft Professional Services Agreement",
    "DRAFT - NOT EXECUTED",
    "DRAFT-PSA-2026-118",
    [
        ["Proposed Supplier", "Westline Engineering Group LLC"],
        ["Draft Reference", "DRAFT-PSA-2026-118"],
        ["Proposed Value", "USD 585,000"],
        ["Proposed Effective Date", "October 1, 2026"],
        ["Proposed Expiration Date", "September 30, 2027"],
        ["Document Status", "Draft - Under Review - Not Executed"],
    ],
    DRAFT_PAGES,
)

build(
    OUTPUT / "02_Executed_Professional_Services_Agreement.pdf",
    "Executed Professional Services Agreement",
    "EXECUTED OCTOBER 10, 2026",
    "PSA-2026-118",
    [
        ["Supplier", "Westline Engineering Group LLC"],
        ["Contract Number", "PSA-2026-118"],
        ["Current Value", "USD 475,000"],
        ["Effective Date", "October 15, 2026"],
        ["Expiration Date", "October 14, 2027"],
        ["Document Status", "Executed October 10, 2026"],
    ],
    EXECUTED_PAGES,
)

print(f"Created enhanced demo contracts in {OUTPUT}")
