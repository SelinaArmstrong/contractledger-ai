# ContractLedger AI

ContractLedger AI is a focused contract-administration portfolio application. It automates the two manual registers that were recurring pain points in the creator's prior work: the official contract register and the supplier register. It also demonstrates a controlled AI workflow for draft review, executed-contract intake, key obligations, renewals, data-quality checks, and Excel handoff.

This is intentionally **not** a full contract lifecycle management (CLM) platform. It does not attempt negotiation, e-signature, approval routing, enterprise identity, or every legal workflow.

## Workflow boundary

1. **Draft review (pre-execution):** upload a draft PDF; DeepSeek extracts traceable fields and compares selected terms with a fictional U.S. company playbook. Saving creates an intake record and may create a `Pending` supplier. It never adds contract value to the official register.
2. **Executed intake (post-execution):** upload a signed PDF; DeepSeek extracts the executed terms for human verification. Saving updates the official contract register, activates or matches the supplier, and creates obligation and renewal dates.
3. **Registers and alerts:** search contracts and suppliers, review upcoming notice dates, resolve low-confidence fields, and export the latest registers in one Excel workbook.

The fictional policy checks are operational review prompts, not legal advice. AI output must be verified against the source document before saving.

## Interview demo

- Start on **Portfolio Dashboard** and explain that only executed contracts count toward the official value.
- Use the **Fictional transaction — negotiation outcome** table to explain how the same supplier and project changed from the proposed draft to the signed source of truth.
- Open **Draft Review**, choose **Use demo PDF**, then run **Analyze with DeepSeek**. Point out source quotes, confidence indicators, and playbook deviations.
- Save the verified draft and show that the supplier is `Pending` while the official contract total is unchanged.
- Open **Executed Intake**, load the executed demo, analyze, verify, and save. Show the new official contract, active supplier, and calculated renewal-notice deadline.
- Use **Export Latest Registers** to download an `.xlsx` workbook containing Contract Register, Supplier Register, and Data Quality Exceptions sheets.

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

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Architecture and data handling

- Vinext/React interface deployed on OpenAI Sites
- Cloudflare D1 database for registers, findings, dates, and audit events
- Cloudflare R2 storage for uploaded documents
- DeepSeek Responses API with a strict JSON schema for extraction and review
- ExcelJS, loaded only when requested, for the one-click register workbook

The API key is server-side only. Uploaded document text is treated as untrusted input, bounded by file size/page/text limits, and never allowed to override system instructions. The app stores a document reference and extracted records; reviewers remain responsible for verifying every material field.

## Source structure

- `app/api/analyze/route.ts` — PDF extraction and DeepSeek analysis
- `app/api/workspace/route.ts` — stage-aware save workflow
- `db/schema.ts` and `db/bootstrap.ts` — D1 schema and fictional seed data
- `components/contract-ledger-app.tsx` — interview-ready application interface
- `lib/export-registers.ts` — three-sheet Excel export
- `public/demo-documents/` — fictional draft and executed agreements
