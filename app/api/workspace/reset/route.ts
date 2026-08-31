import { resetWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';
import { authorizeApiRequest } from '@/lib/server/request-security';

export async function POST(request: Request) {
  const access = authorizeApiRequest(request, { write: true, admin: true });
  if (!access.ok) return access.response;

  try {
    await resetWorkspaceDatabase();
    return Response.json({ reset: true, workspace: await getWorkspace() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reset the demo workspace.',
      },
      { status: 500 },
    );
  }
}
