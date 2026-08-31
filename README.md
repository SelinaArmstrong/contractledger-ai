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
7. **AI evaluation:** run three locked fictional documents against fixed ground truth. The app calculates field accuracy, source coverage, and average confidence from live model output without adding evaluation files to operational registers.

The fictional policy checks are operational review prompts, not legal advice. AI output must be verified against the source document before saving.

## Interview demo

- Start on **Portfolio Dashboard** and explain that only executed contracts count toward the official value.
- Open **New Contract Review**, choose **Use demo PDF**, and run **Analyze with DeepSeek**. Correct or confirm every extracted field; point out confidence, source page, source quote, and playbook differences.
- Save the reviewed draft and show that the supplier is `Pending` while the official contract total is unchanged.
- Open **Contract Register**, select **Register executed contract**, analyze the signed demo, confirm the extracted values, and save. Show the new official contract, active supplier, renewal deadline, and AI audit trail in contract details.
- Return to the Dashboard and show the newly generated **AI draft-to-executed comparison**.
- Open **Supplier Register**, select a supplier, upload the demo insurance certificate, and choose **Analyze with AI**. Explain supplier-name matching and human-reviewed metadata.
- Open **Alerts & Exports** to show separate contract and supplier-compliance warnings.
- Open **AI Evaluation** to show the saved accuracy and source-traceability evidence, then rerun it if time allows.
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

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Architecture and data handling

- Vinext/React interface running locally for the interview demo
- Cloudflare D1 database for registers, findings, dates, and audit events
- Cloudflare R2 storage for uploaded documents
- DeepSeek Responses API with a strict JSON schema for extraction and review
- ExcelJS, loaded only when requested, for the one-click register workbook

The API key is server-side only. Uploaded document text is treated as untrusted input, bounded by file size/page/text limits, and never allowed to override system instructions. The app stores a document reference and extracted records; reviewers remain responsible for verifying every material field.

## Source structure

- `app/api/analyze/route.ts` — contract PDF extraction and DeepSeek analysis
- `app/api/analyze-supplier-document/route.ts` — supplier PDF/image extraction and qualification review
- `app/api/evaluations/route.ts` and `lib/ai-evaluation.ts` — locked ground truth and persisted AI evaluation evidence
- `app/api/workspace/route.ts` — stage-aware save workflow
- `db/schema.ts` and `db/bootstrap.ts` — D1 schema and fictional seed data
- `components/contract-ledger-app.tsx` — interview-ready application interface
- `lib/export-registers.ts` — three-sheet Excel export
- `public/demo-documents/` — fictional draft and executed agreements
