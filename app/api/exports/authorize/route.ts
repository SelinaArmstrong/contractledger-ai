import { authorizeApiRequest } from '@/lib/server/request-security';

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, {
    permission: 'export_data',
  });
  if (!access.ok) return access.response;

  return Response.json({ authorized: true });
}
