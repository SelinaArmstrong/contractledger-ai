import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  authenticateWorkspaceCredentials,
  createDemoSessionToken,
  demoSessionCookie,
} from '@/lib/workspace-auth';

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(300),
});

function redirectTo(request: Request, error?: string) {
  const url = new URL('/', request.url);
  if (error) url.searchParams.set('auth_error', error);
  return url;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function loginRateLimited(request: Request) {
  await ensureWorkspaceDatabase();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowSeconds = 15 * 60;
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const clientAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const result = await env.DB.prepare(`INSERT INTO api_rate_limits
      (key, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET request_count = request_count + 1
      RETURNING request_count`)
    .bind(`demo-login:${clientAddress}:${windowStart}`, windowStart)
    .first<{ request_count: number }>();
  return (result?.request_count ?? 1) > 5;
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.redirect(redirectTo(request, 'invalid'), 303);

  try {
    if (await loginRateLimited(request))
      return Response.redirect(redirectTo(request, 'rate_limit'), 303);
    const formData = await request.formData();
    const input = loginSchema.parse({
      username: formData.get('username'),
      password: formData.get('password'),
    });
    const account = authenticateWorkspaceCredentials(
      input.username,
      input.password,
    );
    if (!account) return Response.redirect(redirectTo(request, 'invalid'), 303);

    const token = await createDemoSessionToken(account.username);
    return new Response(null, {
      status: 303,
      headers: {
        Location: redirectTo(request).toString(),
        'Set-Cookie': demoSessionCookie(
          token,
          new URL(request.url).protocol === 'https:',
        ),
      },
    });
  } catch {
    return Response.redirect(redirectTo(request, 'invalid'), 303);
  }
}
