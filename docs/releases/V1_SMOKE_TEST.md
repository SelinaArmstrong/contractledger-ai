# ContractLedger AI v1.0 smoke test

**Executed:** 2026-09-02
**Environment:** local Vinext development server with local D1 and R2 bindings
**Data boundary:** fictional portfolio fixtures only

## Automated baseline

Run the application at `http://localhost:3000`, then run `npm run check:baseline`.

- [x] Application home responds and loads the seeded dashboard.
- [x] Two consecutive resets return byte-for-byte identical workspace snapshots.
- [x] Reset restores seven contracts, eight suppliers, three intakes, five obligations, five approval records, and one import preview.
- [x] Current executed value is USD 4,055,000 and does not include draft values.
- [x] All 15 fixture files are present, non-empty, visibly labeled fictional, use only reserved example email domains, and are served by the application.
- [x] All nine database-seeded document links open as PDFs.
- [x] Amendment history, approval details, obligation evidence, and import history load from the reset state.
- [x] Review-package PDF, obligation calendar, and export authorization succeed.
- [x] Missing document and obligation identifiers return controlled 400 responses.
- [x] A final reset removes export audit writes and restores the approved baseline exactly.

## Interface walkthrough

- [x] Dashboard loads seven active contracts, USD 4.06M current value, seven active suppliers, two records to verify, four open approvals, and four open obligations.
- [x] Portfolio Case Study shows 15 fictional evaluation cases, seven roles, thirteen permissions, and the 101-test v1.0 baseline.
- [x] Bulk Import & Data Quality opens the four-row fictional dry run and its visible ready, duplicate, and invalid states.
- [x] Contract Register shows seven verified records, current/original/amendment values, lifecycle versions, dates, owners, terms, and status.
- [x] Contracts without a notice period no longer display the misleading text “Not found days.”
- [x] The remaining primary workspaces are reachable from keyboard-accessible navigation and retain explicit empty, loading, success, and failure messaging.

## Core lifecycle traceability

The reset scenario and deterministic test suite jointly cover the complete supported route:

1. `int-001` demonstrates reviewed draft intake and source-linked findings without entering official totals.
2. The approval suite and seeded queue demonstrate deterministic generation, decisions, escalation, immutable history, and the executed-registration gate; `int-003` retains a completed approval after execution.
3. `con-003` demonstrates an intake-linked executed agreement; contract lifecycle tests cover the transactional registration boundary.
4. `con-002` preserves original value and amendment lineage; the fictional Amendment No. 2 fixture exercises the next version, resulting-value, date, payment-term, and notice calculations.
5. `con-001` demonstrates assigned obligations, overdue calculation, completion evidence, history, calendar export, and outbox creation.
6. Record details and the review-package export expose sources, approvals, versions, reviewer history, and audit events.

This is reproducible portfolio evidence for implemented workflow controls. It is not a claim that one seeded record represents real-company throughput, legal correctness, or measured time savings.
