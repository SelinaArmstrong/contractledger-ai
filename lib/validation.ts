import { z } from 'zod';

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, 'Enter a valid calendar date in YYYY-MM-DD format.');

/**
 * Media types a stored document may declare.
 *
 * `/api/document` serves stored files back with `Content-Disposition: inline`,
 * so the recorded media type decides how a browser renders them. Save routes
 * accept this value from the client, which means an unconstrained string would
 * let an uploader label a file `text/html` and have it execute as script on the
 * workspace's own origin. Uploads are already restricted to PDF, plain text and
 * images by their magic bytes; this is the matching constraint on what the
 * database is allowed to remember about them.
 */
export const STORED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
] as const;

export const storedDocumentMimeTypeSchema = z.enum(STORED_DOCUMENT_MIME_TYPES);
