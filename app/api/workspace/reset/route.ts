import { resetWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';

export async function POST() {
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
