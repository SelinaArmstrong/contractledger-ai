# Phase execution gate

Roadmap item 15 is implemented as a versioned phase manifest and a fail-closed repository check. Every major phase follows the same ten-step path: define, fixture first, model, business logic, API, interface, test, measure, demonstrate, and document.

## Workflow

1. Copy `phase-template.json` into `docs/execution-loop/phases/` before implementation.
2. Complete the definition fields: user story, business rules, non-goals, and acceptance criteria.
3. Record the previous phase and link its completion evidence. A first phase may use `null`.
4. List every known unresolved data-integrity or audit-trail defect in the start gate. A phase cannot become `active` or `complete` until both lists are empty and the previous phase is complete.
5. Work through the ten steps in order. Only one step may be `in_progress`; a later step cannot finish before an earlier one.
6. Attach repository evidence to every completed step. Use `not_applicable` only with a phase-specific rationale of at least 30 characters.
7. Save a bounded metric with its sample size and source, then set the phase status to `complete` only after all ten steps are complete or explicitly not applicable.
8. Run `npm run check:phase`. Pull requests and `npm run quality` execute the same check.

## States and evidence

- Phase states are `draft`, `active`, and `complete`. Draft phases must have ten pending steps.
- Step states are `pending`, `in_progress`, `complete`, and `not_applicable`.
- File-backed evidence (`documentation`, `file`, `fixture`, `migration`, and `test`) must exist inside the repository. `command` and `metric` evidence records the exact reproducible claim.
- The checker validates structure, sequence, evidence presence, and the explicit start gate. It does not establish that attached evidence is substantively correct or that a command ran on a particular commit; code review and CI retain those responsibilities.

## Failure behavior

The gate reports plain-text `PASS` or `FAIL` results and exits non-zero for malformed manifests, missing or reordered steps, premature step completion, multiple in-progress steps, incomplete predecessor evidence, open integrity/audit defects on a started phase, missing evidence paths, weak exclusions, and metrics without a source or sample size.
