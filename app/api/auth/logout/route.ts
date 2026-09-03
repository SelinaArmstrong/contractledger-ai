import { clearDemoSessionCookie } from '@/lib/workspace-auth';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== url.origin)
        return Response.json({ error: 'Forbidden.' }, { status: 403 });
    } catch {
      return Response.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/', url).toString(),
      'Set-Cookie': clearDemoSessionCookie(url.protocol === 'https:'),
    },
  });
}
