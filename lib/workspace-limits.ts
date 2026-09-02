/**
 * The workspace payload is a single snapshot the workbench loads on start, so
 * every register query it contains has to be bounded. These caps are the
 * ceiling for that snapshot, not a product limit: past them a register needs
 * server-side paging and filtering rather than a bigger response.
 */
export const WORKSPACE_REGISTER_LIMIT = 500;
export const WORKSPACE_ALERT_LIMIT = 200;

export type RegisterTotals = {
  contracts: number;
  suppliers: number;
  intakes: number;
  keyDates: number;
};

/**
 * Describes a register whose snapshot was capped, so the view can say so
 * instead of silently showing a partial list as if it were complete.
 */
export type RegisterTruncation = {
  truncated: boolean;
  loaded: number;
  total: number;
  limit: number;
  message: string;
};

export function registerTruncation(
  loaded: number,
  total: number,
  limit: number = WORKSPACE_REGISTER_LIMIT,
): RegisterTruncation {
  const truncated = total > loaded && loaded >= limit;
  return {
    truncated,
    loaded,
    total,
    limit,
    message: truncated
      ? `Showing the ${loaded} most recent of ${total} records. Narrow the register with search or filters to reach the rest.`
      : '',
  };
}
