import { getWorkspace } from '@/app/api/workspace/route';
import { resetWorkspaceDatabase } from '@/db/bootstrap';
import { withApiRoute } from '@/lib/server/route-handler';

export const POST = withApiRoute(
  {
    permission: 'reset_workspace',
    database: false,
    errorStatus: 500,
    fallbackError: 'Unable to reset the demo workspace.',
  },
  async () => {
    await resetWorkspaceDatabase();
    return Response.json({ reset: true, workspace: await getWorkspace() });
  },
);
