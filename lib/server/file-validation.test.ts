import { describe, expect, it } from 'vitest';

import {
  assertContractFileSignature,
  assertSupplierFileSignature,
} from './file-validation';

describe('document signatures', () => {
  it('accepts matching PDF and UTF-8 text content', async () => {
    await expect(
      assertContractFileSignature(
        new File(['%PDF-1.7 content'], 'agreement.pdf', {
          type: 'application/pdf',
        }),
      ),
    ).resolves.toBe('pdf');
    await expect(
      assertContractFileSignature(
        new File(['Readable agreement text'], 'agreement.txt', {
          type: 'text/plain',
        }),
      ),
    ).resolves.toBe('text');
  });

  it('rejects extension, media-type, binary, and signature mismatches', async () => {
    await expect(
      assertContractFileSignature(
        new File(['not pdf'], 'agreement.pdf', { type: 'application/pdf' }),
      ),
    ).rejects.toThrow(/not a valid PDF/u);
    await expect(
      assertContractFileSignature(
        new File(['%PDF-1.7'], 'agreement.pdf', { type: 'text/plain' }),
      ),
    ).rejects.toThrow(/unsupported media type/u);
    await expect(
      assertContractFileSignature(
        new File([new Uint8Array([65, 0, 66])], 'agreement.txt', {
          type: 'text/plain',
        }),
      ),
    ).rejects.toThrow(/binary data/u);
    await expect(
      assertContractFileSignature(
        new File(['content'], 'agreement.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ),
    ).rejects.toThrow(/PDF or UTF-8 TXT/u);
  });

  it('rejects a supplier file whose signature conflicts with its media type', async () => {
    await expect(
      assertSupplierFileSignature(
        new File(['%PDF-1.7'], 'image.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow(/does not match/u);
  });
});
