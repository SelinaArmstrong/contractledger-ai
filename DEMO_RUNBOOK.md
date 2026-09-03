# ContractLedger AI — 10-Minute Interview Demo

**Audience:** contract administration, legal operations, procurement operations, CLM, and vendor-governance interviewers  
**Goal:** demonstrate one connected, auditable workflow without presenting AI as legal advice

## Before the interview

- Start the application and reset the fictional workspace.
- Run `npm run check:baseline`, `npm run check:phase`, and `npm run check:dod`, then retain their pass summaries alongside the full repository quality-gate result.
- Confirm the draft and executed demo PDFs open.
- If live model access is unavailable, use the saved reviewed records and explain that deterministic controls and saved evidence remain fully demonstrable.
- Keep the Portfolio Case Study view open as the starting point.
- Do not upload real employer, supplier, or client documents.

## Timed walkthrough

| Time       | View                       | Action                                                                                | Evidence to call out                                                                                                                              |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:45  | Portfolio Case Study       | State the operating problem and product boundary.                                     | This is an operational review aid using fictional data, not autonomous legal advice or a full CLM.                                                |
| 0:45–1:35  | Bulk Import & Data Quality | Open the seeded dry run and inspect mapped and normalized rows.                       | Preview is isolated; exact duplicates cannot be accepted; possible matches require a decision; correction output is formula-safe.                 |
| 1:35–2:40  | New Contract Review        | Open the demo draft analysis and inspect one material field and one playbook finding. | Model value and verified value remain separate; page, quote, confidence, reviewer, and override reason are retained.                              |
| 2:40–3:30  | Approvals & Exceptions     | Open a financial or governing-law approval.                                           | The rule version, accountable owner, deadline, source, reason, and immutable decision history survive execution.                                  |
| 3:30–4:20  | Contract Register          | Open the executed agreement and compare it with the draft.                            | Draft value never counted as official; mandatory approvals gate executed registration; negotiated changes are calculated from saved analyses.     |
| 4:20–5:10  | Contract detail            | Review the original agreement and amendment lifecycle.                                | USD 475,000 + USD 75,000 = USD 550,000 current value; the original and version history remain unchanged and visible.                              |
| 5:10–6:05  | Supplier Register          | Open a supplier risk profile.                                                         | The score is deterministic and decomposes into eight visible factors with rules, points, explanations, and saved evidence.                        |
| 6:05–7:05  | Obligations & Evidence     | Open an overdue obligation and a completed obligation.                                | Overdue status is calculated; closeout requires a note and evidence; assignment, status, escalation, and completion are separate events.          |
| 7:05–8:10  | AI Accuracy & Validation   | Open a completed validation run.                                                      | Fifteen controlled fictional cases produce field and critical accuracy, source coverage, failures, duration, correction, and regression evidence. |
| 8:10–9:10  | Contract detail / exports  | Download or describe the review package, workbook, and calendar output.               | Current terms, approvals, sources, versions, and reviewer history can leave the system as controlled operational artifacts.                       |
| 9:10–10:00 | Portfolio Case Study       | Close on evidence and limitations.                                                    | The portfolio claims implemented and measured controls—not unmeasured time savings, legal outcomes, or active external delivery.                  |

If asked how “done” is governed, show `docs/definition-of-done/features/roadmap-14-definition-of-done.json`: all 16 roadmap criteria must be complete or explicitly not applicable, evidence paths must exist, and pending work prevents completion. Clarify that the automated gate verifies evidence structure and presence; human review still assesses evidence quality.

If asked how phase scope is controlled, show `docs/execution-loop/phases/roadmap-15-standard-execution-loop.json`: all ten steps are recorded in order, the predecessor is complete, and the unresolved data-integrity and audit-defect lists are empty. Demonstrate that `npm run check:phase` reports 10 of 10 steps accounted for.

## Suggested opening

> ContractLedger AI demonstrates how I approach contract operations as a controlled data lifecycle. AI proposes structured values, people verify material terms, deterministic rules govern approvals and dates, and every official result stays tied to its source and decision history.

## Suggested close

> The key outcome is not simply extracting fields from a PDF. It is preserving the controls needed to trust those fields after approval, execution, amendment, renewal work, and operational handoff. The remaining step before making productivity claims is repeated timed evidence in a real operating context.

## Recovery paths

- **Model call unavailable:** open the saved intake and continue with verification, approvals, lifecycle, obligations, and evaluation evidence.
- **Upload fails:** explain the visible signature, size, quality, and authorization gate; use a seeded document.
- **No completed import metric:** describe the seeded preview and avoid claiming an acceptance rate until a batch is committed.
- **Time is short:** show the Portfolio Case Study, one contract lifecycle, one obligation, and the AI validation dashboard.

## v1.1 additions to the demo path

- **Opening without credentials.** On the hosted demo a reviewer lands directly in a read-only workspace. Point out the banner: every register, approval, obligation and validation record is readable, while uploads, decisions, imports, AI calls and reset are refused server-side. This is the honest way to show a full workspace without handing out an account.
- **AI Accuracy & Validation now opens populated.** Lead with the grey banner, not the numbers: the report is replayed from fixture ground truth through the live scorer with injected defects, so it demonstrates the measurement instrumentation and not a model's accuracy. Say plainly that it is deliberately barred from becoming an approved baseline, then offer to run the real validation set if a key is configured.
- **Portfolio Case Study → Timed workflow evidence.** Show the stopwatch and the "Not yet claimable" column. The point to make is the refusal: the panel will not state a percentage until three manual and three assisted runs exist for the same scenario. If asked about productivity gains, this is the honest answer — the measurement path is built and the runs are not yet recorded.

### Recovery paths

- **A reviewer asks whether the accuracy numbers are real:** answer no, immediately, and show the banner. The instrumentation is the claim, not the figure.
- **Guest mode blocks something mid-demo:** that is the control working. Sign in for the full workflow, or narrate the refusal as the separation-of-duties boundary.

## v1.2 additions to the demo path

- **Two ways in.** Anyone can browse the workspace read-only with no account at
  all. Reviewers who should run the write and AI workflow are given credentials
  directly; nothing is published, and no credential lives in the repository.
- **What the reviewer account cannot do.** Try **Reset demo** while signed in as
  the reviewer: the server refuses it. That account holds `demo_operator`, which
  runs every workflow including approvals but cannot reset the workspace,
  because credentials are shared and one reviewer should not be able to wipe the
  records another is part-way through. Resetting needs the maintainer account.
- **Why the AI bill is bounded.** Point at the line in **AI Accuracy &
  Validation** showing how many shared AI units remain for the day. Explain the
  three layers — per-actor burst limit, per-visitor hourly budget on a hashed
  address, shared daily ceiling — and that a validation run costs 15 units
  precisely because it makes 15 model calls. The design fails closed: if the
  counters cannot be read, the call is refused rather than allowed.

### Recovery paths

- **AI is refused mid-demo:** that is the ceiling working, and it is worth
  showing rather than hiding. Every saved record, the seeded validation report
  and the exports stay browsable; move to those.
- **Someone has left the workspace messy:** the demo account cannot reset it by
  design. Sign in with the maintainer account, or run the demo locally where
  loopback grants administrator.
