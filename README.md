# ContractLedger AI

ContractLedger AI is a focused AI-assisted contract-administration portfolio application. It converts unstructured contract and supplier-qualification documents into human-verified register data, traceable playbook findings, compliance alerts, and auditable decisions. It addresses two recurring pain points from the creator's prior work: manual contract-register entry and manual supplier-register maintenance.

This is intentionally **not** a full contract lifecycle management (CLM) platform. It does not attempt negotiation, e-signature, enterprise identity, or every legal workflow.

## Workflow boundary

1. **Draft review (pre-execution):** upload a draft PDF; DeepSeek extracts traceable fields and compares selected terms with a versioned fictional U.S. company playbook.
2. **Human verification:** every extracted field can be corrected and must be confirmed before saving. The system preserves the AI original value, verified value, confidence, source page, source quote, reviewer, and review time.
3. **Approval and exception control:** verified values generate versioned approval requirements for financial thresholds, governing law, automatic renewal, supplier insurance, and high-risk supplier classification. Reviewers can approve, decline, request revision, approve an exception with a reason, or escalate; every transition is immutable and source-linked.
4. **Executed registration (post-execution):** upload a signed PDF from the Contract Register. Server-side gates block registration until every mandatory approval on the linked intake is approved. A successful save updates the official contract register, activates or matches the supplier, and creates obligation and renewal dates transactionally.
5. **Supplier-document intelligence:** analyze W-9s, insurance certificates, business licenses, registrations, and other qualification evidence. AI suggests the document type, supplier name, issuer, number, dates, and coverage/qualification summary before human-reviewed upload.
6. **Dynamic draft-to-executed comparison:** after both stages are verified for the same supplier, the dashboard calculates actual changes from the saved analyses instead of displaying a hard-coded comparison.
7. **Obligation execution and evidence:** assign owners and backups, prioritize contract work, move obligations through a controlled status flow, surface overdue work automatically, link completion evidence, preserve event history, and export selected dates to a calendar.
8. **Three distinct AI layers:** use AI Assistant for natural-language factual retrieval (including the approval queue), Management Insights for register-level trends and recommended actions, and AI Accuracy & Validation for a versioned 15-document ground-truth suite that never adds evaluation files to operational registers.
9. **Controlled legacy-data migration:** download CSV/XLSX templates, map common legacy headers, normalize and deduplicate every row in isolated staging tables, explicitly accept or skip each result, and commit or roll back the audited batch.
10. **Registers and exports:** search and filter contracts, suppliers, approvals, obligations, and supplier-compliance alerts; export an audited workbook or selected obligation dates as `.ics`.
11. **Document preflight and separation of duties:** inspect every PDF page before AI analysis, block unreadable/corrupted/password-protected input, flag sparse or rotated pages for human review, and enforce seven workspace roles at the server route that owns each material action.
12. **Operational review and integration readiness:** export a source-aware PDF review package from an executed contract, inspect an eight-factor rules-based supplier risk profile, and retain versioned outbox events for future notification delivery without sending external messages.

The fictional policy checks are operational review prompts, not legal advice. AI output must be verified against the source document before saving.

## Interview demo

- Start on **Portfolio Case Study** and frame the operating problem, product boundary, verified release evidence, and ten-minute route. Use the companion [case study](PORTFOLIO_CASE_STUDY.md), [demo runbook](DEMO_RUNBOOK.md), and [resume evidence ledger](RESUME_EVIDENCE.md) when preparing for an interview.
- Open **Portfolio Dashboard** and explain that only executed contracts count toward the official value.
- Open **Bulk Import & Data Quality**, download a supplier or contract template, and open a prior dry run. Show automatic `Vendor Name → Supplier Legal Name` mapping, normalized values, duplicate candidates, row decisions, the correction report, and the reversible batch history.
- Open **New Contract Review**, choose **Use demo PDF**, and run **Analyze with DeepSeek**. Correct or confirm every extracted field; point out confidence, source page, source quote, and playbook differences.
- Save the reviewed draft and show that it remains a proposed-supplier intake while the Supplier Register and official contract total are unchanged.
- Open **Approvals & Exceptions** and show the deterministic Finance, Legal, contract-owner, and Compliance controls, their deadlines, source evidence, and immutable event history. Record the required decisions and reasons.
- Open **Contract Register**, select **Register executed contract**, analyze the signed demo, confirm the extracted values, and save. The server now permits registration because the linked intake's mandatory approvals are complete. Show the approval history retained on the executed contract.
- Return to the Dashboard and show the newly generated **AI draft-to-executed comparison**.
- Open **Supplier Register**, select a supplier, and walk through the explainable risk profile: every scored factor identifies its rule, points, and saved evidence. Then upload the demo insurance certificate and choose **Analyze with AI** to show supplier-name matching and human-reviewed metadata.
- Open **Obligations & Evidence** and show the assigned work queue, calculated overdue item, priority and backup-owner controls, source clause, status history, completion-evidence requirement, measured workflow metrics, and selected `.ics` export.
- Ask **AI Assistant** a factual question, then demonstrate how a broad portfolio-analysis request routes to the relevant register's **AI management insights**.
- Open **AI Accuracy & Validation** under **Portfolio evidence** to show the 15-document dataset, field and critical-field accuracy, source coverage, failures, processing time, operational correction rates, and prompt/model regression gate. Export the latest CSV appendix or approve a complete run as the comparison baseline.
- Open an executed contract and download its **Review package PDF** to show current terms, source-aware findings, accepted approvals, version history, and reviewer/model history in one operational handoff artifact.
- Generate the current `.xlsx` handoff package from the live database, then point out the pending integration-outbox count beside the obligation metrics.

The two sample agreements form one realistic, fictional U.S. transaction: a ten-page draft and a thirteen-page executed version for the same supplier and project. The signed version reflects negotiated changes to payment, governing law, insurance, liability, intellectual property, subcontracting, data security, change control, and termination rights. All seeded organizations are fictional and safe to use in an interview demonstration.

## Local setup

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
# Add your DeepSeek API key to .env.local
npm run dev
```

Open `http://localhost:3000`.

On macOS, double-click `Start ContractLedger AI.command` for an interview-ready local launch. Keep the terminal window open while demonstrating the app and press Control-C when finished.

For a temporary single-user login on a public demo deployment, configure all four server-side variables below and redeploy. Do not expose them with a `NEXT_PUBLIC_` prefix or commit their real values.

```bash
DEMO_AUTH_USERNAME=your_demo_username
DEMO_AUTH_PASSWORD=use_a_strong_password
DEMO_AUTH_DISPLAY_NAME="Demo User"
DEMO_AUTH_SESSION_SECRET=use_a_random_secret_of_at_least_32_characters
```

This mode issues a signed, HttpOnly, same-site session cookie that expires after 12 hours. It is intended for a controlled trial or portfolio demonstration, not as a replacement for managed multi-user identity.

Authenticated hosted users can be assigned a minimal workspace role with a server-side JSON mapping. Keys may be the authenticated user ID or email address; values must be `requester`, `contract_administrator`, `legal_reviewer`, `procurement_compliance_reviewer`, `approver`, `read_only_auditor`, or `administrator`. Unmapped hosted users default to `read_only_auditor`; localhost and the temporary single-user demo account remain administrators so the self-contained interview workflow still works.

```bash
WORKSPACE_ROLE_ASSIGNMENTS='{"user_123":"contract_administrator","legal@example.com":"legal_reviewer"}'
```

Useful checks:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Architecture and data handling

- Vinext/React interface for the local interview demo and authenticated Sites hosting
- Cloudflare D1 database for registers, findings, dates, and audit events
- Cloudflare R2 storage for uploaded documents
- DeepSeek Responses API with a strict JSON schema for extraction and review
- ExcelJS, loaded only when requested, for the one-click register workbook

The API key is server-side only. Uploaded document text is treated as untrusted input, bounded by file size/page/text limits, and never allowed to override system instructions. File extensions, declared media types, UTF-8 text content, and PDF/image signatures are checked before parsing. PDF preflight then records page count, inspected-page count, text characters, blank or sparse pages, and page rotation. Corrupted, password-protected, structurally incomplete, or wholly unreadable PDFs are blocked before the model call. Partially sparse or rotated inputs remain visibly marked `needs_review`, their report is stored with the AI run, and every operational save still requires human verification. Images are marked OCR-ready/manual-review inputs; no OCR provider is claimed or silently invoked in v0.7.

Hosted API requests require either authenticated Sites user headers or a valid temporary demo session. Audit events use that identity and workspace role, state-changing requests are same-origin only, and AI endpoints have per-user D1-backed rate limits. Demo login attempts are limited to five per client address in a 15-minute window. A centralized role policy independently gates document submission, verified-field editing, supplier maintenance, exception approval, amendment application, obligation completion, bulk imports, AI/governance actions, exports, and reset. Export generation performs a server authorization check before creating the local workbook. Localhost and the temporary demo account use a clearly identified administrator actor; other hosted identities receive only their configured role and default to read-only.

D1 bootstrap is versioned with an application migration ledger: schema upgrades and fictional seed synchronization run only when the stored version is behind, rather than writing during every request. Approval requests use rule snapshots so later playbook versions cannot rewrite historical decisions. The workspace endpoint returns register and queue summaries; document metadata, approval decisions, and AI review history load only when a specific record is opened. Charting and workbook generation are lazy-loaded to keep them off the initial application path.

Bulk imports use separate `import_batches` and `import_rows` staging records. CSV/XLSX signatures, UTF-8 CSV content, a 5 MB file limit, 150-row batch limit, unique headers, and formula-injection characters are checked before commit. Mapping version `2026.1`, original row values, normalized values, issues, decisions, created record IDs, actors, and timestamps remain auditable. Contract imports require an exact supplier-master match; possible matches are never merged automatically. Rollback is blocked if a created supplier or contract has acquired dependent documents, intakes, amendments, or contracts.

Obligations extend the existing `key_dates` register rather than creating a parallel task system. Durable workflow status follows `upcoming → in_progress → evidence_required → completed`; `overdue` is calculated from the due date and cannot be selected or hidden manually. Completion requires a note plus an existing related document, a safely uploaded PDF/image stored in R2, or a bounded external evidence reference. `obligation_events` retains assignment, status, evidence, escalation, and amendment-driven due-date changes. The queue derives on-time completion, overdue aging, evidence coverage, and median assignment/completion time directly from saved timestamps and always exposes the underlying sample through the visible records.

Supplier risk profile version `supplier-risk-2026.1` is deterministic and factor-level explainable. It combines the human-approved classification, W-9 and insurance controls, qualification completeness, visible screening/standing records, linked high-risk findings, active-value concentration, and overdue obligations. Each factor returns its rule result, points, explanation, and evidence. The calculated profile does not use an AI-generated risk score and does not silently overwrite the human-reviewed supplier master tier.

Review package version `review-package-2026.1` is generated server-side from current contract, finding, approval, amendment, source, and AI-review records. The authorized PDF response is private/no-store, uses a stable sanitized filename, states that it is an operational aid rather than legal advice, and writes an export audit event. `integration_outbox` records versioned obligation completion, status-change, update, and escalation events transactionally for future webhook or notification delivery; no external delivery provider is configured or claimed.

Approval history records both the authenticated actor's actual workspace role and the rule's accountable owner role. Contract administrators can verify operational data but cannot approve their own exceptions through the approval route; Legal, Procurement/Compliance, and Approver roles can decide exceptions but cannot edit verified contract fields. The policy is intentionally workspace-scoped rather than a full multi-tenant identity administration system.

AI Accuracy & Validation is server-controlled. The server loads 15 fixed fictional fixtures spanning draft and executed contracts, supplier records, an amendment, ambiguous inputs, and a negative case. It performs fresh analysis with bounded concurrency; persists run, case, and field-level results; records model, prompt, extraction, fixture and dataset versions, duration and failures; calculates critical-field accuracy, source coverage, unsupported-value rate, processing success, and regression delta; and never accepts client-submitted case IDs or model results. Complete runs can be approved as the dataset baseline, while a critical-accuracy regression beyond two points blocks promotion. Operational `ai_field_reviews` supply correction-rate evidence, and unsupported critical saved values require an explicit reviewer override reason retained in the audit trail. The latest validation appendix exports as CSV with achieved metrics and sample/version labels.

## Source structure

The implementation sequence, release gates, metrics, and portfolio evidence plan are maintained in the [product roadmap](ROADMAP.md).

The portfolio narrative and claim controls are maintained as three interview-ready artifacts:

- `PORTFOLIO_CASE_STUDY.md` — problem, product boundary, lifecycle decisions, controls, validation method, evidence, and limitations
- `DEMO_RUNBOOK.md` — paced ten-minute walkthrough, opening and closing language, and recovery paths
- `RESUME_EVIDENCE.md` — release-by-release evidence, safe claim boundaries, candidate resume bullets, and evidence still required

- `app/api/analyze/route.ts` — contract PDF extraction and DeepSeek analysis
- `app/api/analyze-supplier-document/route.ts` — supplier PDF/image extraction and qualification review
- `app/api/evaluations/route.ts`, `lib/ai-evaluation.ts`, and `lib/ai-governance.ts` — versioned 15-document ground truth, field-level results, regression gates, validation CSV export, and source-override controls
- `app/api/workspace/route.ts` — stage-aware save workflow
- `app/api/approvals/route.ts` and `lib/approval-workflow.ts` — deterministic rules, state transitions, approval actions, execution gates, and decision history
- `app/api/imports/route.ts`, `lib/bulk-import.ts`, and `lib/server/import-file.ts` — CSV/XLSX templates and parsing, versioned mapping, normalization, duplicate review, staged commit, correction reports, and precise rollback
- `app/api/obligations/route.ts` and `lib/obligation-workflow.ts` — controlled obligation transitions, completion evidence, overdue escalation, immutable history, workflow metrics, and calendar export
- `app/api/review-package/route.ts` and `lib/review-package.ts` — authorized, audited operational-review PDF generation with source, approval, version, and reviewer history
- `lib/supplier-risk.ts` and `lib/integration-outbox.ts` — transparent supplier factor scoring and versioned future-delivery event envelopes
- `lib/document-quality.ts` — page-level PDF preflight, OCR-readiness signals, and clear blocked/manual-review states shared by contract, amendment, and supplier analysis
- `app/api/auth/` and `lib/demo-auth.ts` — temporary server-side demo login and signed sessions
- `app/api/record-details/route.ts` — on-demand document metadata and AI review history
- `db/schema.ts` and `db/bootstrap.ts` — D1 schema and fictional seed data
- `components/contract-ledger-app.tsx` — interview-ready application interface
- `components/management-chart-card.tsx` — lazy-loaded management chart bundle
- `lib/server/request-security.ts` — authenticated actor, seven-role permission policy, same-origin write protection, and rate limiting
- `lib/export-registers.ts` — current register, data-quality, supplier-document, approval-queue, and obligation-evidence Excel export
- `public/demo-documents/` — fictional draft and executed agreements
