import { chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { clearDemoSessionCookie } from '@/lib/demo-auth';

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
  const hasSitesIdentity = Boolean(
    request.headers.get('oai-authenticated-user-id'),
  );
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(
        hasSitesIdentity ? chatGPTSignOutPath('/') : '/',
        url,
      ).toString(),
      'Set-Cookie': clearDemoSessionCookie(url.protocol === 'https:'),
    },
  });
}
