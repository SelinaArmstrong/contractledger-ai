import { extractText, getDocumentProxy } from 'unpdf';

export type DocumentQualityStatus = 'ready' | 'needs_review' | 'blocked';

export type DocumentPageQuality = {
  pageNumber: number;
  textCharacters: number;
  rotation: number;
  blank: boolean;
  lowTextDensity: boolean;
  requiresOcr: boolean;
  requiresManualReview: boolean;
  issues: string[];
};

export type DocumentQualityReport = {
  version: 'document-preflight-2026.1';
  status: DocumentQualityStatus;
  fileName: string;
  mimeType: string;
  totalPages: number;
  inspectedPages: number;
  textCharacters: number;
  requiresOcr: boolean;
  requiresManualReview: boolean;
  issues: string[];
  pages: DocumentPageQuality[];
};

export class DocumentQualityError extends Error {
  readonly report: DocumentQualityReport;

  constructor(message: string, report: DocumentQualityReport) {
    super(message);
    this.name = 'DocumentQualityError';
    this.report = report;
  }
}

type PageInput = {
  text: string;
  rotation?: number;
};

function normalizedRotation(value: number | undefined) {
  const rotation = Number.isFinite(value) ? Number(value) : 0;
  return ((rotation % 360) + 360) % 360;
}

export function buildDocumentQualityReport(input: {
  fileName: string;
  mimeType: string;
  totalPages: number;
  pages: PageInput[];
  minimumUsableCharacters?: number;
}): DocumentQualityReport {
  const minimumUsableCharacters = input.minimumUsableCharacters ?? 80;
  const pages = input.pages.map((page, index): DocumentPageQuality => {
    const textCharacters = page.text.replace(/\s/gu, '').length;
    const rotation = normalizedRotation(page.rotation);
    const blank = textCharacters === 0;
    const lowTextDensity = textCharacters > 0 && textCharacters < 80;
    const issues: string[] = [];
    if (blank) issues.push('No text was detected on this page.');
    else if (lowTextDensity)
      issues.push('This page has a sparse or incomplete text layer.');
    if (rotation !== 0)
      issues.push(`This page is rotated ${rotation} degrees.`);
    return {
      pageNumber: index + 1,
      textCharacters,
      rotation,
      blank,
      lowTextDensity,
      requiresOcr: blank || lowTextDensity,
      requiresManualReview: blank || lowTextDensity || rotation !== 0,
      issues,
    };
  });
  const textCharacters = pages.reduce(
    (total, page) => total + page.textCharacters,
    0,
  );
  const issues: string[] = [];
  if (input.totalPages <= 0) issues.push('The PDF contains no readable pages.');
  if (pages.length !== input.totalPages) {
    issues.push(
      `Expected ${input.totalPages} pages but only ${pages.length} could be inspected.`,
    );
  }
  for (const page of pages) {
    for (const issue of page.issues) {
      issues.push(`Page ${page.pageNumber}: ${issue}`);
    }
  }
  const blocked =
    input.totalPages <= 0 ||
    pages.length !== input.totalPages ||
    textCharacters < minimumUsableCharacters;
  const requiresManualReview = pages.some((page) => page.requiresManualReview);
  return {
    version: 'document-preflight-2026.1',
    status: blocked
      ? 'blocked'
      : requiresManualReview
        ? 'needs_review'
        : 'ready',
    fileName: input.fileName,
    mimeType: input.mimeType,
    totalPages: input.totalPages,
    inspectedPages: pages.length,
    textCharacters,
    requiresOcr: pages.some((page) => page.requiresOcr),
    requiresManualReview: blocked || requiresManualReview,
    issues,
    pages,
  };
}

function blockedReport(
  file: File,
  issue: string,
  totalPages = 0,
): DocumentQualityReport {
  return {
    version: 'document-preflight-2026.1',
    status: 'blocked',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    totalPages,
    inspectedPages: 0,
    textCharacters: 0,
    requiresOcr: false,
    requiresManualReview: true,
    issues: [issue],
    pages: [],
  };
}

function parsingIssue(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (/password/i.test(`${name} ${message}`)) {
    return 'The PDF is password-protected and cannot be analyzed.';
  }
  return 'The PDF is corrupted or its page structure cannot be read.';
}

export async function preflightPdf(
  file: File,
  options: {
    maximumPages: number;
    timeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
      label: string,
    ) => Promise<T>;
    minimumUsableCharacters?: number;
  },
) {
  try {
    const pdf = await options.timeout(
      getDocumentProxy(new Uint8Array(await file.arrayBuffer()), {
        maxImageSize: 16_777_216,
      }),
      12_000,
      'PDF parsing',
    );
    if (pdf.numPages > options.maximumPages) {
      const report = blockedReport(
        file,
        `The file contains ${pdf.numPages} pages; the limit is ${options.maximumPages}.`,
        pdf.numPages,
      );
      throw new DocumentQualityError(report.issues[0], report);
    }
    const extracted = await options.timeout(
      extractText(pdf, { mergePages: false }),
      18_000,
      'PDF text extraction',
    );
    const texts = Array.isArray(extracted.text)
      ? extracted.text
      : [extracted.text];
    const pageInputs = await Promise.all(
      texts.map(async (text, index) => ({
        text,
        rotation: (await pdf.getPage(index + 1)).rotate,
      })),
    );
    const report = buildDocumentQualityReport({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      totalPages: pdf.numPages,
      pages: pageInputs,
      minimumUsableCharacters: options.minimumUsableCharacters,
    });
    if (report.status === 'blocked') {
      throw new DocumentQualityError(
        'No usable text layer was found. OCR or manual review is required before analysis.',
        report,
      );
    }
    return { report, pages: texts };
  } catch (error) {
    if (error instanceof DocumentQualityError) throw error;
    const issue = parsingIssue(error);
    throw new DocumentQualityError(issue, blockedReport(file, issue));
  }
}

export function preflightText(file: File, text: string, minimum = 80) {
  const report = buildDocumentQualityReport({
    fileName: file.name,
    mimeType: file.type || 'text/plain',
    totalPages: 1,
    pages: [{ text }],
    minimumUsableCharacters: minimum,
  });
  if (report.status === 'blocked') {
    throw new DocumentQualityError(
      'The text file does not contain enough readable content for analysis.',
      report,
    );
  }
  return { report, pages: [text] };
}

export function imageQualityReport(file: File): DocumentQualityReport {
  return {
    version: 'document-preflight-2026.1',
    status: 'needs_review',
    fileName: file.name,
    mimeType: file.type,
    totalPages: 1,
    inspectedPages: 1,
    textCharacters: 0,
    requiresOcr: true,
    requiresManualReview: true,
    issues: [
      'Image input has no text layer; visual extraction requires human verification.',
    ],
    pages: [
      {
        pageNumber: 1,
        textCharacters: 0,
        rotation: 0,
        blank: false,
        lowTextDensity: true,
        requiresOcr: true,
        requiresManualReview: true,
        issues: [
          'Image input has no text layer; visual extraction requires human verification.',
        ],
      },
    ],
  };
}

export function qualityWarnings(report: DocumentQualityReport) {
  if (report.status === 'ready') return [];
  return [
    `Document preflight requires human review (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'}).`,
    ...report.issues,
  ];
}
