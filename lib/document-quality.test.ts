import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import {
  buildDocumentQualityReport,
  imageQualityReport,
  preflightPdf,
} from './document-quality';

describe('document quality preflight', () => {
  it('accepts complete upright text pages', () => {
    const report = buildDocumentQualityReport({
      fileName: 'agreement.pdf',
      mimeType: 'application/pdf',
      totalPages: 2,
      pages: [{ text: 'A'.repeat(200) }, { text: 'B'.repeat(160) }],
    });

    expect(report.status).toBe('ready');
    expect(report.requiresOcr).toBe(false);
    expect(report.issues).toEqual([]);
  });

  it('requires review for blank, sparse, and rotated pages', () => {
    const report = buildDocumentQualityReport({
      fileName: 'mixed.pdf',
      mimeType: 'application/pdf',
      totalPages: 3,
      pages: [
        { text: 'A'.repeat(200) },
        { text: '' },
        { text: 'short text', rotation: 90 },
      ],
    });

    expect(report.status).toBe('needs_review');
    expect(report.requiresOcr).toBe(true);
    expect(report.pages[1]).toMatchObject({ blank: true, requiresOcr: true });
    expect(report.pages[2]).toMatchObject({
      lowTextDensity: true,
      rotation: 90,
    });
  });

  it('blocks documents with no usable text or missing inspected pages', () => {
    const unreadable = buildDocumentQualityReport({
      fileName: 'scan.pdf',
      mimeType: 'application/pdf',
      totalPages: 2,
      pages: [{ text: '' }, { text: '' }],
    });
    const incomplete = buildDocumentQualityReport({
      fileName: 'damaged.pdf',
      mimeType: 'application/pdf',
      totalPages: 3,
      pages: [{ text: 'A'.repeat(200) }, { text: 'B'.repeat(200) }],
    });

    expect(unreadable.status).toBe('blocked');
    expect(incomplete.status).toBe('blocked');
    expect(incomplete.issues[0]).toMatch(/only 2 could be inspected/u);
  });

  it('marks image extraction as OCR-ready but human-reviewed', () => {
    const report = imageQualityReport(
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'scan.jpg', {
        type: 'image/jpeg',
      }),
    );

    expect(report.status).toBe('needs_review');
    expect(report.requiresOcr).toBe(true);
    expect(report.requiresManualReview).toBe(true);
  });

  it('preflights the fictional contract fixture page by page', async () => {
    const bytes = await readFile(
      'public/demo-documents/01_Draft_Professional_Services_Agreement.pdf',
    );
    const result = await preflightPdf(
      new File([bytes], '01_Draft_Professional_Services_Agreement.pdf', {
        type: 'application/pdf',
      }),
      {
        maximumPages: 40,
        timeout: (promise) => promise,
      },
    );

    expect(result.report.status).toBe('ready');
    expect(result.report.totalPages).toBe(10);
    expect(result.report.pages).toHaveLength(10);
  });
});
