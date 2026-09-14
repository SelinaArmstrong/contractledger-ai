# Pre-release fixes — 2026-09-14

Review base: `5f3c85ee9e5c06ac02cc3f9bc79116b4b67ec340`. Fixes are in the working tree; no deployment was performed.

| Finding | Resolution | Evidence |
| --- | --- | --- |
| P1 stored PDF preview blocked | Document responses permit same-origin framing. Only PDF omits CSP sandbox for native readers; other types remain sandboxed with MIME allowlisting and nosniff. | Real Chrome rendered the four-page Harbor agreement inside its detail dialog; response policies covered by route tests and HTTP baseline. |
| P1 reviewer could decide another role's step | PATCH checks the assigned step owner against the authenticated role; UI uses the same mapping. | Signed legal-reviewer session receives 403 for Finance/CFO, performs no write, and can decide Legal Reviewer steps. |
| P1 old approval authorized changed execution terms | Explicit intake selection and verified-term snapshots replace supplier-only matching. Changed terms or legacy missing snapshots require fresh review. | $585,000 approval cannot register $1,500,000 even within the same approval band. Fresh review/approval of $1,500,000 permits registration; unchanged terms pass. |
| P1 expired insurance retained a current label | Read-time and execution gating derive expiry from the certificate date. | An expired supplier cannot bypass insurance approval for a low-value contract; UI also shows expired status. |
| P2 old certificate kept renewal expired | Explicit same-supplier/type replacement atomically supersedes an eligible predecessor. Active aggregates/alerts exclude superseded records, while history stays readable. | Current verified renewal clears old expiry; unverified, future or problematic replacement does not. Separate certificates and cross-supplier/type attempts cannot silently retire evidence. |
| Dependency high advisories | Upgrade and override sharp to 0.35.4 including Miniflare's copy. | npm audit: zero high/critical, six moderate, documented in SECURITY.md. |
| Release verification gaps | CI now runs high-severity audit, disposable-runtime HTTP/SEO checks and a Chromium PDF rendering regression. | Local HTTP/SEO checks pass; browser test discovery passes. The standalone Playwright runner/hosted CI has not been executed in this session; equivalent visual flow verified through Chrome. |
| Additional response-header gap | Root/about page middleware supplies the security headers omitted by current rendered-page handling. Document policy stays route-specific. | Built-runtime baseline asserts DENY on the home page and SAMEORIGIN on every seeded document. |

## Validation

- `npm run quality`: 28 test files, 263 passing tests; phase/DoD gates, lint, TypeScript and production build passed.
- `npm run check:baseline -- --base-url http://127.0.0.1:8791`: passed against a disposable local Worker/D1/R2 instance, including two equivalent reset snapshots, nine document links and primary workflow smoke checks.
- `npm run check:seo -- http://127.0.0.1:8791 http://127.0.0.1:8791`: 17 page/image cases plus robots, sitemap, manifest and ICO checks passed.
- Real Chrome: contract detail opens and renders the original PDF's text, thumbnails and page controls after final build. The Codex in-app browser does not render native PDFs, including direct static PDF navigation.
- `npm audit --audit-level=high`: passed; six moderate reports remain in the documented uuid/exceljs and esbuild/drizzle-kit dependency paths.
- `git diff --check`: passed.

## Operating changes and limits

No schema migration is needed. Existing approvals without verified-term snapshots fail closed for new registrations. Review the exact updated agreement through a new intake, finish required decisions, then explicitly select that intake during execution registration. This includes changes to contract number, dates, amount or other verified terms. See DEMO_RUNBOOK.md for role ownership and certificate replacement behavior.

Live paid model calls were not exercised. Build still reports its existing large-chunk and framework deprecation/classification warnings; these are not measured performance failures. The hosted CI browser job must run after these changes are pushed before treating that automation as validated.

## Follow-up: preserve committed upload files

Fixed the supplier upload error handler so it cleans up a newly stored file only before a successful database commit. A later workspace-refresh failure still returns an error, but preserves the saved document and its file; refresh the workspace before retrying an upload.

Added two fault-injection regressions using the actual route and SQLite: a post-commit workspace failure leaves the document readable with identical PDF bytes, while a failed database batch leaves no document and deletes the newly uploaded file. The first test reproduced the erroneous deletion before the fix. Final suite: 263 tests passed.
