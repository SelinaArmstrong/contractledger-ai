# Definition of Done gate

Roadmap item 14 is enforced as a versioned, reviewable release gate rather than an informal checklist. Every major feature must add one JSON manifest under `docs/definition-of-done/features/` by copying `feature-template.json`.

## Workflow

1. Write the contract-operations user story before implementation.
2. Keep a criterion `pending` until its evidence exists.
3. Use `not_applicable` only with a feature-specific rationale. The gate treats applicability as an explicit decision, not a silent omission.
4. Record repository-relative files, test files, fixtures, migrations, documentation, metrics, and exact quality commands as evidence.
5. Set the feature status to `complete` only when no criterion remains pending.
6. Run `npm run check:dod`. Pull requests and `npm run quality` run the same gate after the standard phase-execution check.

The checker fails closed on missing, duplicate, unknown, or pending criteria; missing evidence files; unsupported status values; incomplete quality-command evidence; missing documentation surfaces; and metrics without a source or sample size.

The command is fully keyboard-operated, emits plain text without relying on color, labels results as `PASS` or `FAIL`, and returns a non-zero exit code on failure for terminal and CI accessibility.

## Evidence rules

- `complete` requires one or more evidence entries.
- File-backed evidence kinds (`documentation`, `file`, `fixture`, `migration`, and `test`) must point to an existing path inside the repository. Unknown evidence kinds and paths that escape the repository are rejected. A `#section` or `:line` suffix may be added for human navigation.
- `not_applicable` requires a concrete rationale of at least 30 characters.
- Quality-gate evidence must list `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- Documentation evidence must include `README.md`, `DEMO_RUNBOOK.md`, `ROADMAP.md`, and a limitations location.
- Metrics require a name, bounded value, positive sample size, and source path. Fictional samples must be identified as fictional in the referenced evidence.

The gate validates evidence presence and checklist completeness; it cannot prove that a review was thoughtful, that a UI is accessible in every assistive technology, or that a passing command was run on a particular commit. Code review and CI remain responsible for those judgments.
