import { env } from 'cloudflare:workers';
import { z } from 'zod';
import {
  getRegisterOptions,
  getRegisterPage,
  getRegisterRecord,
} from '@/lib/server/register-list';
import { withApiRoute } from '@/lib/server/route-handler';

const scopeSchema = z.enum(['contracts', 'suppliers']);
const idSchema = z.string().min(1).max(200);

export const GET = withApiRoute(
  {
    permission: 'view_workspace',
    errorStatus: 500,
    redactErrors: true,
    fallbackError: 'Unable to load the register.',
  },
  async ({ url }) => {
    const params = url.searchParams;
    const scope = scopeSchema.parse(params.get('scope'));
    if (params.has('id')) {
      const record = await getRegisterRecord(
        env.DB,
        scope,
        idSchema.parse(params.get('id')),
      );
      if (!(scope === 'contracts' ? record.contract : record.supplier))
        return Response.json(
          { error: 'Register record not found.' },
          { status: 404 },
        );
      return Response.json(record);
    }
    if (params.get('options') === 'true')
      return Response.json(await getRegisterOptions(env.DB, scope));
    return Response.json(await getRegisterPage(env.DB, scope, params));
  },
);
