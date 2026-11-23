import { env } from 'cloudflare:workers';
import { z } from 'zod';
import type { RegisterExportData } from '@/lib/export-registers';
import type { RegisterRow } from '@/lib/registers';
import {
  approvalQueueQuery,
  contractRegisterQuery,
  keyDatesQuery,
  normalizeSupplierRow,
  orderedRows,
  supplierDocumentsQuery,
  supplierRegisterQuery,
} from '@/lib/server/register-data';
import { withApiRoute } from '@/lib/server/route-handler';

const scopeSchema = z.enum(['all', 'suppliers']);

export const POST = withApiRoute(
  {
    permission: 'export_data',
    errorStatus: 500,
    redactErrors: true,
    fallbackError: 'Unable to prepare the register export.',
  },
  async ({ url }) => {
    const scope = scopeSchema.parse(url.searchParams.get('scope') ?? 'all');
    const queries = [supplierRegisterQuery, supplierDocumentsQuery];
    if (scope === 'all')
      queries.push(contractRegisterQuery, keyDatesQuery, approvalQueueQuery);
    const [suppliers, supplierDocuments, contracts, keyDates, approvalQueue] =
      await env.DB.batch<RegisterRow>(
        queries.map((query) => env.DB.prepare(orderedRows(query))),
      );
    const today = new Date().toISOString().slice(0, 10);
    suppliers.results.forEach((row) => normalizeSupplierRow(row, today));
    const data: RegisterExportData = {
      suppliers: suppliers.results,
      supplierDocuments: supplierDocuments.results,
      contracts: contracts?.results ?? [],
      keyDates: keyDates?.results ?? [],
      approvalQueue: (approvalQueue?.results ??
        []) as RegisterExportData['approvalQueue'],
    };
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  },
);
