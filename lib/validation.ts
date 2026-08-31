import { z } from 'zod';

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, 'Enter a valid calendar date in YYYY-MM-DD format.');
