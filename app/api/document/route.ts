import { env } from 'cloudflare:workers';
import { withApiRoute } from '@/lib/server/route-handler';
import { STORED_DOCUMENT_MIME_TYPES } from '@/lib/validation';

/**
 * Stored documents are returned inline so a reviewer can read a contract
 * without downloading it. That makes the response's media type a security
 * boundary: a browser renders whatever it is told this file is.
 *
 * Save routes constrain what may be recorded, but rows written before that
 * constraint existed are still in the database, so the value is re-checked
 * here. Anything unrecognised is served as an opaque download rather than
 * trusted, and `nosniff` stops the browser from second-guessing either way.
 */
function safeContentType(recorded: string | null, fallback: string) {
  const value = (recorded ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return (STORED_DOCUMENT_MIME_TYPES as readonly string[]).includes(value)
    ? value
    : fallback;
}

function documentHeaders(fileName: string, contentType: string) {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    // Source readers are same-origin frames. Outside sites must remain blocked.
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'" +
      // Browser PDF viewers cannot render a sandboxed response. MIME validation
      // and nosniff keep this exception limited to PDF; other uploads stay sandboxed.
      (contentType === 'application/pdf' ? '' : '; sandbox'),
  };
}

export const GET = withApiRoute(
  {
    permission: 'view_documents',
    errorStatus: 500,
    fallbackError: 'Unable to open the document.',
  },
  async ({ url }) => {
    const id = url.searchParams.get('id');
    if (!id)
      return Response.json(
        { error: 'Document id is required.' },
        { status: 400 },
      );

    const document = await env.DB.prepare(
      'SELECT file_name, storage_key, mime_type FROM documents WHERE id = ? LIMIT 1',
    )
      .bind(id)
      .first<{ file_name: string; storage_key: string; mime_type: string }>();
    if (!document)
      return Response.json({ error: 'Document not found.' }, { status: 404 });

    if (document.storage_key.startsWith('public:/demo-documents/')) {
      const publicPath = document.storage_key.slice('public:'.length);
      const asset = await fetch(new URL(publicPath, url));
      if (!asset.ok || !asset.body)
        return Response.json(
          { error: 'Demo file not found.' },
          { status: 404 },
        );
      return new Response(asset.body, {
        headers: documentHeaders(
          document.file_name,
          safeContentType(document.mime_type, 'application/pdf'),
        ),
      });
    }

    const object = await env.FILES.get(document.storage_key);
    if (!object)
      return Response.json(
        { error: 'Stored file not found.' },
        { status: 404 },
      );

    return new Response(object.body, {
      headers: documentHeaders(
        document.file_name,
        safeContentType(document.mime_type, 'application/octet-stream'),
      ),
    });
  },
);
