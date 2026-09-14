# Security Policy

ContractLedger AI is a portfolio project. It is not a supported commercial
product, and the hosted demo holds only fictional records. It does, however,
accept file uploads, call a third-party model API and run a public deployment,
so security reports are welcome and taken seriously.

## Supported versions

Only the `main` branch is supported. Fixes land there; there are no backports.

## Reporting a vulnerability

Please report privately, not in a public issue.

Use GitHub's private vulnerability reporting on this repository:
**Security → Report a vulnerability**. That opens a private advisory visible
only to the maintainer, and it needs no email address from either side.

A useful report includes the affected route or file, what an attacker gains,
and the smallest sequence of requests that shows it. Proof-of-concept code is
welcome. Please do not run automated scanners, load tests or destructive
actions against the hosted demo — a local checkout reproduces everything.

Expect an acknowledgement within about a week. Because this is a personal
project, please treat any timeline beyond that as best-effort.

## Scope

In scope: authentication and session handling, the workspace role and
permission model, upload validation and stored-file serving, the AI budget and
rate limiting, and anything that lets one visitor affect another's records.

Out of scope: findings that require an already-compromised maintainer machine,
missing hardening with no demonstrated impact, volumetric denial of service,
and reports about the fictional contents of `public/demo-documents/`.

## Design notes for reviewers

Several properties are deliberate and are covered by tests in
`lib/server/request-security.test.ts` and `lib/workspace-auth.test.ts`:

- **No credentials ship in this repository.** Accounts exist only when the
  deployment supplies `DEMO_AUTH_*` / `ADMIN_AUTH_*`. Without
  `WORKSPACE_SESSION_SECRET` no account can sign in at all, because a known
  signing key would make the session cookie itself the credential.
- **The loopback maintainer shortcut is opt-in** via `ALLOW_LOCAL_MAINTAINER`.
  A request's hostname derives from the client-supplied `Host` header, so it is
  never sufficient on its own to grant the administrator role.
- **`X-Forwarded-For` is ignored** unless `TRUST_PROXY_ADDRESS_HEADER` is set,
  so rate-limit and AI-budget keys cannot be rotated by a caller.
- **Stored documents are served with `nosniff` and same-origin framing only**, and their
  recorded media type is checked against an allowlist on write and again on
  read. PDFs omit CSP sandbox so native PDF readers work; other media remain sandboxed.
- **The AI assistant never generates SQL.** The model returns a structured
  query plan whose entities and fields are validated against an allowlist, and
  it is executed in memory against records the caller may already read.

## Known advisories in the dependency tree

`npm audit` reports six moderate advisories. Both clusters were checked against
how the code actually uses the package, and neither is reachable here. They are
listed rather than silenced, and will be cleared when the upstream projects
release fixes that do not require a breaking downgrade.

| Advisory | Path | Why it does not apply |
| --- | --- | --- |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) (`uuid`) | `exceljs` → `uuid` | The advisory needs `uuid` v3/v5/v6 called with a `buf` argument. `exceljs` calls only `uuid.v4()` with no arguments, in `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`. The only fix offered is `exceljs@3.4.0`, a breaking downgrade. |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (`esbuild`) | `drizzle-kit` → `@esbuild-kit/*` → `esbuild` | Concerns the esbuild development server. `drizzle-kit` is a development dependency invoked by hand through `npm run db:generate`; it is not part of `npm run quality`, CI, the build, or anything that runs in production. |

Every high-severity advisory in the tree has been cleared.

Audit rechecked on 2026-09-14: zero high/critical and six moderate reports.
`sharp` is pinned to 0.35.4 and overridden across the dependency tree, including
Miniflare, to remove the vulnerable libheif version. CI rejects high/critical reports.
