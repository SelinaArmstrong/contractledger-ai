export const REVIEW_PACKAGE_VERSION = 'review-package-2026.1' as const;

export type ReviewPackageRecord = Record<string, string | number | null>;

export type ReviewPackageData = {
  contract: ReviewPackageRecord;
  findings: ReviewPackageRecord[];
  approvals: ReviewPackageRecord[];
  versions: ReviewPackageRecord[];
  reviews: ReviewPackageRecord[];
  generatedAt: string;
  generatedBy: string;
};

type PackageLine = {
  text: string;
  kind: 'title' | 'heading' | 'body' | 'meta' | 'spacer';
};

function display(value: unknown, fallback = 'Not recorded') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function money(cents: unknown) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 'Not recorded';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function safeAscii(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrap(value: string, width: number) {
  const words = safeAscii(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildLines(data: ReviewPackageData): PackageLine[] {
  const { contract } = data;
  const lines: PackageLine[] = [
    { text: 'ContractLedger AI - Operational Review Package', kind: 'title' },
    {
      text: `Package version ${REVIEW_PACKAGE_VERSION} | Generated ${data.generatedAt} by ${data.generatedBy}`,
      kind: 'meta',
    },
    {
      text: 'Operational review aid only. This package is not legal advice and does not replace review of the signed source documents.',
      kind: 'meta',
    },
    { text: '', kind: 'spacer' },
    { text: 'Contract metadata', kind: 'heading' },
    {
      text: `Contract: ${display(contract.contract_number)} - ${display(contract.title)}`,
      kind: 'body',
    },
    {
      text: `Supplier: ${display(contract.supplier_name)} | Type: ${display(contract.contract_type)}`,
      kind: 'body',
    },
    {
      text: `Department: ${display(contract.department)} | Owner: ${display(contract.owner)}`,
      kind: 'body',
    },
    {
      text: `Status: ${display(contract.status)} | Effective: ${display(contract.effective_date)} | Expires: ${display(contract.expiration_date)}`,
      kind: 'body',
    },
    {
      text: `Original value: ${money(contract.original_value_cents)} | Current value: ${money(contract.current_value_cents)} | Renewal: ${display(contract.renewal_type)} | Notice: ${display(contract.notice_days)} days`,
      kind: 'body',
    },
    { text: '', kind: 'spacer' },
    { text: 'High-risk findings and operational response', kind: 'heading' },
  ];

  const materialFindings = data.findings.filter((finding) =>
    ['medium', 'high'].includes(String(finding.severity)),
  );
  if (!materialFindings.length) {
    lines.push({
      text: 'No medium- or high-risk findings are linked to this executed contract.',
      kind: 'body',
    });
  } else {
    materialFindings.forEach((finding, index) => {
      lines.push(
        {
          text: `${index + 1}. ${display(finding.rule_name)} [${display(finding.severity).toUpperCase()} / ${display(finding.status)}]`,
          kind: 'body',
        },
        {
          text: `Current language: ${display(finding.observed_text)}`,
          kind: 'body',
        },
        {
          text: `Preferred language/control: ${display(finding.standard_text)}`,
          kind: 'body',
        },
        {
          text: `Suggested operational revision: ${display(finding.suggested_revision)}`,
          kind: 'body',
        },
        {
          text: `Source: ${display(finding.source_file_name, 'Linked source document')}, page ${display(finding.source_page)}`,
          kind: 'meta',
        },
      );
    });
  }

  lines.push(
    { text: '', kind: 'spacer' },
    { text: 'Accepted deviations and approval decisions', kind: 'heading' },
  );
  if (!data.approvals.length) {
    lines.push({
      text: 'No approval controls are linked to this contract.',
      kind: 'body',
    });
  } else {
    data.approvals.forEach((approval, index) => {
      lines.push(
        {
          text: `${index + 1}. ${display(approval.rule_name)} v${display(approval.rule_version)} - ${display(approval.request_status)}`,
          kind: 'body',
        },
        {
          text: `Reason: ${display(approval.reason)} | Accountable role: ${display(approval.owner_role)}`,
          kind: 'body',
        },
        {
          text: `Decision: ${display(approval.action, display(approval.step_status))} by ${display(approval.actor, display(approval.assigned_reviewer))} (${display(approval.actor_role, display(approval.owner_role))}) at ${display(approval.decision_at, display(approval.completed_at))}`,
          kind: 'body',
        },
        {
          text: `Decision reason: ${display(approval.decision_reason)} | Source page ${display(approval.source_page)}`,
          kind: 'meta',
        },
      );
    });
  }

  lines.push(
    { text: '', kind: 'spacer' },
    { text: 'Version history and current effective terms', kind: 'heading' },
  );
  lines.push({
    text: `V1 original agreement - ${money(contract.original_value_cents)} effective ${display(contract.effective_date)}`,
    kind: 'body',
  });
  data.versions.forEach((version) => {
    lines.push(
      {
        text: `V${display(version.version_number)} ${display(version.amendment_number)} [${display(version.version_status)}]`,
        kind: 'body',
      },
      {
        text: `Value ${money(version.previous_value_cents)} -> ${money(version.resulting_value_cents)} | Expiration ${display(version.previous_expiration_date)} -> ${display(version.new_expiration_date)}`,
        kind: 'body',
      },
      {
        text: `Scope: ${display(version.scope_summary)} | Applied by ${display(version.created_by)} at ${display(version.created_at)}`,
        kind: 'meta',
      },
    );
  });

  lines.push(
    { text: '', kind: 'spacer' },
    { text: 'Human review and model history', kind: 'heading' },
  );
  if (!data.reviews.length) {
    lines.push({
      text: 'No verified AI review run is linked to this contract.',
      kind: 'body',
    });
  } else {
    data.reviews.forEach((review) => {
      lines.push({
        text: `${display(review.stage)} review - ${display(review.file_name)} | ${display(review.model)} / ${display(review.prompt_version)} | ${display(review.correction_count, '0')} correction(s) | reviewed by ${display(review.reviewed_by)} at ${display(review.reviewed_at)}`,
        kind: 'body',
      });
    });
  }
  return lines;
}

function escapePdfText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function paginate(lines: PackageLine[]) {
  const rendered = lines.flatMap((line) => {
    if (line.kind === 'spacer') return [{ ...line, text: '' }];
    const width =
      line.kind === 'title' ? 58 : line.kind === 'heading' ? 72 : 92;
    return wrap(line.text, width).map((text) => ({ ...line, text }));
  });
  const pages: PackageLine[][] = [];
  let page: PackageLine[] = [];
  let used = 0;
  for (const line of rendered) {
    const height =
      line.kind === 'title'
        ? 24
        : line.kind === 'heading'
          ? 20
          : line.kind === 'spacer'
            ? 8
            : 14;
    if (used + height > 650 && page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(line);
    used += height;
  }
  if (page.length) pages.push(page);
  return pages;
}

function pageStream(
  lines: PackageLine[],
  pageNumber: number,
  pageCount: number,
) {
  const commands: string[] = ['0.12 0.22 0.27 rg'];
  let y = 744;
  for (const line of lines) {
    const size =
      line.kind === 'title'
        ? 18
        : line.kind === 'heading'
          ? 13
          : line.kind === 'meta'
            ? 8
            : 9.5;
    const leading =
      line.kind === 'title'
        ? 24
        : line.kind === 'heading'
          ? 20
          : line.kind === 'spacer'
            ? 8
            : 14;
    if (line.kind === 'spacer') {
      y -= leading;
      continue;
    }
    if (line.kind === 'heading') commands.push('0.12 0.44 0.56 rg');
    else if (line.kind === 'meta') commands.push('0.35 0.42 0.46 rg');
    else commands.push('0.12 0.22 0.27 rg');
    commands.push(
      `BT /F1 ${size} Tf 48 ${y} Td (${escapePdfText(line.text)}) Tj ET`,
    );
    y -= leading;
  }
  commands.push('0.42 0.47 0.50 rg');
  commands.push(
    `BT /F1 8 Tf 48 28 Td (ContractLedger AI | Operational review aid | Page ${pageNumber} of ${pageCount}) Tj ET`,
  );
  return commands.join('\n');
}

export function buildReviewPackagePdf(data: ReviewPackageData) {
  const pages = paginate(buildLines(data));
  const fontObject = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((page, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream(page, index + 1, pages.length);
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObject] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let output = '%PDF-1.4\n%CLAI\n';
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

export function reviewPackageFileName(contractNumber: unknown) {
  const safe = display(contractNumber, 'Contract')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safe || 'Contract'}_Operational_Review_Package.pdf`;
}
