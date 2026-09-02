import { env } from 'cloudflare:workers';
import { withApiRoute } from '@/lib/server/route-handler';

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
        headers: {
          'Content-Type': document.mime_type || 'application/pdf',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const object = await env.FILES.get(document.storage_key);
    if (!object)
      return Response.json(
        { error: 'Stored file not found.' },
        { status: 404 },
      );

    return new Response(object.body, {
      headers: {
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
