# ContractLedger AI

ContractLedger AI is a focused AI-assisted contract-administration portfolio application. It converts unstructured contract and supplier-qualification documents into human-verified register data, traceable playbook findings, compliance alerts, and auditable decisions. It addresses two recurring pain points from the creator's prior work: manual contract-register entry and manual supplier-register maintenance.

This is intentionally **not** a full contract lifecycle management (CLM) platform. It does not attempt negotiation, e-signature, approval routing, enterprise identity, or every legal workflow.

## Workflow boundary

1. **Draft review (pre-execution):** upload a draft PDF; DeepSeek extracts traceable fields and compares selected terms with a versioned fictional U.S. company playbook.
2. **Human verification:** every extracted field can be corrected and must be confirmed before saving. The system preserves the AI original value, verified value, confidence, source page, source quote, reviewer, and review time.
3. **Executed registration (post-execution):** upload a signed PDF from the Contract Register. Saving the reviewed values updates the official contract register, activates or matches the supplier, and creates obligation and renewal dates.
4. **Supplier-document intelligence:** analyze W-9s, insurance certificates, business licenses, registrations, and other qualification evidence. AI suggests the document type, supplier name, issuer, number, dates, and coverage/qualification summary before human-reviewed upload.
5. **Dynamic draft-to-executed comparison:** after both stages are verified for the same supplier, the dashboard calculates actual changes from the saved analyses instead of displaying a hard-coded comparison.
6. **Registers and alerts:** search and filter contracts and suppliers, review separate contract and supplier-compliance alerts, manage renewal decisions, and export the latest database state.
7. **Three distinct AI layers:** use AI Assistant for natural-language factual retrieval, Management Insights for register-level trends and recommended actions, and AI Accuracy & Validation for a locked ground-truth test that never adds evaluation files to operational registers.

The fictional policy checks are operational review prompts, not legal advice. AI output must be verified against the source document before saving.

## Interview demo

- Start on **Portfolio Dashboard** and explain that only executed contracts count toward the official value.
- Open **New Contract Review**, choose **Use demo PDF**, and run **Analyze with DeepSeek**. Correct or confirm every extracted field; point out confidence, source page, source quote, and playbook differences.
- Save the reviewed draft and show that the supplier is `Pending` while the official contract total is unchanged.
- Open **Contract Register**, select **Register executed contract**, analyze the signed demo, confirm the extracted values, and save. Show the new official contract, active supplier, renewal deadline, and AI audit trail in contract details.
- Return to the Dashboard and show the newly generated **AI draft-to-executed comparison**.
- Open **Supplier Register**, select a supplier, upload the demo insurance certificate, and choose **Analyze with AI**. Explain supplier-name matching and human-reviewed metadata.
- Open **Alerts & Exports** to show separate contract and supplier-compliance warnings.
- Ask **AI Assistant** a factual question, then demonstrate how a broad portfolio-analysis request routes to the relevant register's **AI management insights**.
- Open **AI Accuracy & Validation** under **Portfolio evidence** to show saved accuracy and source-traceability evidence, then rerun the locked validation set if time allows.
- Generate the current `.xlsx` handoff package from the live database.

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

The API key is server-side only. Uploaded document text is treated as untrusted input, bounded by file size/page/text limits, and never allowed to override system instructions. File signatures are checked before parsing. The app stores a document reference and extracted records; reviewers remain responsible for verifying every material field.

Hosted API requests require either authenticated Sites user headers or a valid temporary demo session. Audit events use that identity, state-changing requests are same-origin only, and AI endpoints have per-user D1-backed rate limits. Demo login attempts are limited to five per client address in a 15-minute window. Localhost uses a clearly identified local demo actor so the interview workflow remains self-contained. Hosted data reset is restricted to configured Sites administrators or the single demo account.

D1 bootstrap is versioned with `PRAGMA user_version`: schema upgrades and fictional seed synchronization run only when the stored version is behind, rather than writing during every request. The workspace endpoint returns register summaries; document metadata and AI review history load only when a specific record is opened. Charting and workbook generation are lazy-loaded to keep them off the initial application path.

AI Accuracy & Validation is server-controlled. The server loads the three fixed fictional benchmark documents, performs fresh analysis, scores against locked ground truth, and persists the evidence; it does not accept client-submitted model results.

## Source structure

- `app/api/analyze/route.ts` — contract PDF extraction and DeepSeek analysis
- `app/api/analyze-supplier-document/route.ts` — supplier PDF/image extraction and qualification review
- `app/api/evaluations/route.ts` and `lib/ai-evaluation.ts` — locked ground truth and persisted AI evaluation evidence
- `app/api/workspace/route.ts` — stage-aware save workflow
- `app/api/auth/` and `lib/demo-auth.ts` — temporary server-side demo login and signed sessions
- `app/api/record-details/route.ts` — on-demand document metadata and AI review history
- `db/schema.ts` and `db/bootstrap.ts` — D1 schema and fictional seed data
- `components/contract-ledger-app.tsx` — interview-ready application interface
- `components/management-chart-card.tsx` — lazy-loaded management chart bundle
- `lib/server/request-security.ts` — authenticated actor, same-origin write protection, and rate limiting
- `lib/export-registers.ts` — three-sheet Excel export
- `public/demo-documents/` — fictional draft and executed agreements
