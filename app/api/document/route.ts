import { env } from 'cloudflare:workers';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';

export async function GET(request: Request) {
  try {
    await ensureWorkspaceDatabase();
    const id = new URL(request.url).searchParams.get('id');
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
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to open the document.',
      },
      { status: 500 },
    );
  }
}
