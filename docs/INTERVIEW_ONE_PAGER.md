# ContractLedger AI — one-page summary

**Live demo:** <https://contractledger.selinaq.com/> · **Built by:** Selina Armstrong ([LinkedIn](https://www.linkedin.com/in/selinaarmstrong/))
**Target roles:** Contract Administrator · Contract Operations Analyst · Legal Operations Analyst · CLM Analyst · Procurement Operations · Vendor Governance

## The problem

Contract and supplier teams inherit disconnected PDFs, spreadsheets, inbox approvals and hand-maintained calendars. The operational risk is not slow data entry — it is that an unsupported value, a missed amendment, an unresolved exception or an undocumented obligation can end up looking official with no defensible source and no accountable reviewer.

## The approach

ContractLedger AI is an AI-assisted contract-operations workbench built on one rule: **AI proposes, deterministic code decides, a human confirms anything material.**

- **Drafts and official records are different objects.** A reviewed draft stays an intake; its proposed value never reaches the contract total or supplier master data.
- **Source support outranks confidence.** Every material field keeps the model value, the verified value, confidence, source page, source quote, reviewer and timestamp. A critical value with no source support requires a written override reason.
- **Effective terms are reproducible.** Amendments update current value, expiration, notice dates and open obligations together while preserving the before/after lineage.
- **Reversibility is a control.** Bulk imports stage, decide per row, commit transactionally, and roll back — unless later records depend on the imported data.

## What is actually built

Seven workspace roles across thirteen server-enforced permissions; rule-driven approvals that block executed registration until complete; page-level document preflight before any model call; explainable eight-factor supplier risk; obligations with evidence-backed completion; CSV/XLSX migration with dependency-aware rollback; XLSX/PDF/ICS exports; and a 15-document AI validation suite with a critical-field regression gate.

## What the evidence supports

**Can claim:** implemented controls, reproducible fictional scenarios, dataset size, test coverage (23 files / 140 tests), and saved workflow metrics.

**Cannot claim yet:** real-company time savings, production-scale duplicate precision, legal outcome quality, or external notification delivery. The validation page ships a _seeded demonstration report_ that is labelled in the UI as replayed fixture data rather than a model measurement, and the timed-evidence panel refuses to state a percentage reduction until both manual and assisted modes have at least three recorded runs.

That boundary is the point: the project is designed to be defensible under questioning, not to present the largest possible number.

## Deliberate non-goals

No negotiation, no e-signature, no OCR service, no external notification delivery, no multi-tenancy. All organisations, people, agreements and outcomes are fictional, and nothing here is legal advice.

## Stack

React 19 · Vinext / Next.js App Router · TypeScript (strict) · Tailwind CSS 4 · Drizzle ORM · Cloudflare D1 + R2 + Workers · DeepSeek with Zod-validated structured output · Vitest · Oxlint

**Further reading:** [full case study](../PORTFOLIO_CASE_STUDY.md) · [resume evidence ledger](../RESUME_EVIDENCE.md) · [demo runbook](../DEMO_RUNBOOK.md)
