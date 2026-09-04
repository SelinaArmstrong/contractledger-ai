# Contributing

Thanks for looking. This is a personal portfolio project rather than a product
seeking co-maintainers, so the realistic answer to "will you merge my feature?"
is: probably not, unless we have talked about it first. Bug reports, security
reports and small focused fixes are genuinely welcome.

## Before you open a pull request

Open an issue first for anything beyond a clear bug fix. The project has an
explicit scope — see `ROADMAP.md` — and a change that is good in the abstract
can still be wrong for it.

For security problems, do not open an issue. Follow `SECURITY.md`.

## Getting set up

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. `ALLOW_LOCAL_MAINTAINER=true` in `.env.example`
signs you in locally as the maintainer, and the workspace seeds itself with
fictional records. No API key is needed to browse; a `DEEPSEEK_API_KEY` is only
required to exercise analysis, the Assistant, Insights or an evaluation run.

## The quality gate

Everything must pass before a pull request is reviewed, and CI runs the same
command:

```bash
npm run quality
```

That is, in order: phase-execution manifests, definition-of-done manifests,
`vitest`, `oxlint`, `tsc --noEmit`, and a production build. Run the pieces
individually while iterating — `npm test`, `npm run lint`, `npm run typecheck`.

## What the code expects of a change

- **Match the surrounding code.** This codebase comments the *why* of a
  non-obvious decision and leaves the *what* to the code. Follow that.
- **Every API route goes through `withApiRoute` and declares a permission.**
  A route without one is a bug, not a shortcut.
- **Never trust a request header for authorisation.** `Host`, `Origin` and
  `X-Forwarded-For` are all client-supplied. See `lib/server/request-security.ts`.
- **Never build SQL from model output.** Model responses are parsed into
  validated structures and executed against allowlists.
- **Demo data stays fictional.** No real people, companies, addresses, tax
  identifiers or credentials — including in `scripts/*.py` and any regenerated
  PDF in `public/demo-documents/`.
- **Add a test that fails before your fix.** Security fixes especially.

## Commit and PR style

Write commit messages that explain why the change is right, not what the diff
already shows. Fill in the pull request template; it asks for the evidence the
quality gate produced.
