import { withApiRoute } from '@/lib/server/route-handler';

export const POST = withApiRoute(
  { permission: 'export_data', database: false },
  async () => Response.json({ authorized: true }),
);
