# ContractLedger AI Portfolio Case Study

**Version:** 1.0.0 portfolio-ready baseline · live at <https://contractledger.selinaq.com/>
**Evidence date:** 2026-09-02  
**Target roles:** Contract Administrator, Contract Operations Analyst, Legal Operations Analyst, CLM Analyst, Procurement Operations, and Vendor Governance

## Executive summary

ContractLedger AI is a fictional-data contract-operations system built to demonstrate how unstructured agreements and supplier records can become verified, auditable operational data. It keeps proposed terms separate from the executed register, requires human confirmation for material AI-extracted fields, routes policy exceptions to accountable reviewers, preserves amendments as reproducible effective terms, and turns post-execution dates into evidence-backed work.

The project is intentionally narrower than a full CLM. Its portfolio value comes from showing the controls behind reliable contract administration rather than presenting AI output as an autonomous legal decision.

## 1. The operating problem

Contract and supplier teams often inherit disconnected PDFs, spreadsheets, inbox decisions, and manually maintained calendars. The operational risk is not merely slow data entry. It is that an unsupported value, missed amendment, unresolved exception, or undocumented obligation can appear official without a defensible source or reviewer.

The product addresses four linked failure modes:

- legacy registers enter the system without silent deduplication or normalization;
- proposed and executed terms remain visibly separate;
- material exceptions cannot disappear before accountable review; and
- current terms and post-execution work remain traceable to source evidence.

## 2. Product boundary

The system is an operational review and administration aid. It does not provide legal advice, autonomously negotiate language, execute signatures, send external notifications, or claim enterprise multi-tenancy. All organizations, people, agreements, and qualification records in the demonstration are fictional.

## 3. Lifecycle design

1. A CSV, XLSX, contract, amendment, or supplier document enters an isolated validation step.
2. Deterministic checks validate file type, content quality, mapping, normalization, and known business rules.
3. AI may propose structured values, but a human must verify material fields against a page and quote or record a reasoned override.
4. Versioned approval rules create durable exception decisions before signature or executed registration.
5. Executed records enter the official register only after required controls pass.
6. Amendments preserve the original agreement while calculating the current effective state.
7. Key dates become assigned obligations with status history and completion evidence.
8. Exports, review packages, quality metrics, and audit history expose how each result was produced.

## 4. Key product decisions

### Draft and official records are different objects

A reviewed draft remains an intake. Its proposed value never contributes to the official contract total. Executed registration is a separately authorized operation with approval gates.

### Source support matters more than confidence

Every material AI-assisted field retains the original model value, verified value, confidence, source page, source quote, reviewer, and review time. A critical value without direct support requires an explicit override reason.

### Effective terms must be reproducible

The original agreement, amendments, and current lifecycle version remain separate. Applying an amendment updates current value, expiration, notice dates, and open obligations together while preserving the before/after history.

### AI and rules have separate jobs

AI extracts and summarizes document language. Deterministic code owns approval triggers, lifecycle arithmetic, overdue status, supplier risk factors, permission checks, and evaluation gates.

### Reversibility is a first-class control

Bulk imports use staging tables, explicit row decisions, transactional commit, and audited rollback. Rollback is blocked when later records depend on an imported supplier or contract.

## 5. Human oversight and security controls

- Eight workspace roles map to thirteen named permissions enforced by server routes.
- Contract administrators can verify operational data but cannot approve their own exceptions through the approval route.
- Unreadable, corrupted, protected, or unsupported files are blocked before model analysis.
- Sparse, rotated, image-only, or otherwise uncertain pages are marked for manual review.
- State-changing requests are same-origin protected; hosted access requires an authenticated Sites identity or bounded demo session.
- Documents remain in private object storage and sensitive responses use no-store behavior.

## 6. Validation methodology

The AI validation suite uses 15 server-controlled fictional cases with immutable ground truth. Results are saved at run, case, and field level with dataset, fixture, prompt, extraction, and model versions. The system calculates field accuracy, critical-field accuracy, source coverage, unsupported-value rate, processing success, duration, human correction evidence, and regression delta.

A complete run may become the approved baseline. A later prompt or model is blocked from promotion when critical-field accuracy falls more than two percentage points below that baseline. Evaluation documents never enter operational registers.

The repository quality gate includes versioned 16-criterion Definition of Done manifests, a ten-step phase-execution manifest, deterministic tests, linting, TypeScript checking, and a production build. The phase gate blocks reordered or premature work, incomplete predecessors, open data-integrity or audit defects, absent evidence paths, and metrics without a source or sample size. The 2026-09-02 portfolio baseline contains 182 passing automated tests, including seven Definition of Done and nine phase-execution validator tests, nine route-wrapper tests and fourteen timed-evidence tests. These are deterministic unit and validator tests over domain logic; there is no end-to-end browser suite.

## 7. Reproducible evidence

| Release    | Reproducible evidence                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.2       | USD 475,000 original value plus a verified USD 75,000 amendment produces USD 550,000 current value without overwriting the original.                                  |
| v0.3       | Five versioned fictional approval rules, an immutable decision history, and an execution gate cover financial, legal, renewal, insurance, and supplier-risk controls. |
| v0.4       | CSV/XLSX dry runs retain mapping, normalized values, row issues, explicit decisions, correction output, commit evidence, and dependency-aware rollback.               |
| v0.5       | Five seeded obligations include open, overdue, and evidence-backed completion states with calculated workflow metrics and calendar export.                            |
| v0.6       | Fifteen fictional benchmark cases produce field-level metrics and a two-percentage-point critical-accuracy regression gate.                                           |
| v0.7       | Eight roles, thirteen permissions, document preflight, and denied-write tests demonstrate separation of duties and input-quality controls.                            |
| v0.8       | A source-aware PDF review package, eight visible supplier-risk factors, and durable integration-outbox events support operational handoff.                            |
| Governance | Two versioned repository gates account for 16 Definition of Done criteria and all ten ordered execution steps, including predecessor and defect controls.             |

## 8. Results, limitations, and next steps

The v1.0.0 system demonstrates a connected contract-operations lifecycle rather than isolated UI mockups. It can safely stage legacy data, review a draft, retain approval decisions, register an executed agreement, apply an amendment, assign obligations, show evidence, evaluate AI quality, and export operational artifacts from one resettable fictional workspace. Two consecutive reset snapshots are byte-for-byte equivalent, and the saved baseline checks all 15 fictional source files plus nine seeded document links.

The evidence supports claims about implemented controls, reproducible scenarios, dataset size, test coverage, and saved workflow metrics. The governance gates check declared structure, sequence, start conditions, and file-backed evidence; they do not replace code review, accessibility review, substantive evidence review, or prove that a command ran on a particular commit. The evidence does not yet support a claim about real-company time savings, production-scale duplicate precision, legal outcome quality, or external notification delivery.

The hosted deployment is live at <https://contractledger.selinaq.com/>, and a read-only guest mode lets a reviewer browse the full workspace without credentials while every write, import, AI and reset route stays refused server-side.

The timed-evidence mechanism the previous revision called for is now built: the case-study view records manual and AI-assisted runs of the same fictional scenario, stores the median and sample size per mode, and withholds any percentage reduction until both modes reach three runs. The next evidence step is to actually record those runs.

The validation page ships a seeded demonstration report so it is not empty without an API key. Its figures are replayed from fixture ground truth through the same scorer a live run uses, with a fixed set of injected defects. The interface labels it as instrumentation evidence rather than a model measurement, and the run is deliberately excluded from becoming an approved regression baseline.
