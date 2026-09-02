export function calculateResultingContractValue(
  currentValueCents: number,
  statedDeltaDollars: number | null,
  statedResultDollars: number | null,
) {
  const resultingValueCents =
    statedResultDollars === null
      ? currentValueCents + Math.round((statedDeltaDollars ?? 0) * 100)
      : Math.round(statedResultDollars * 100);

  return {
    resultingValueCents,
    valueChangeCents: resultingValueCents - currentValueCents,
  };
}

export function formatAmendmentNumber(
  extractedValue: string,
  fallbackSequence: number,
) {
  const trimmed = extractedValue.trim();
  if (!trimmed) return `Amendment No. ${fallbackSequence}`;
  if (/^\d+$/.test(trimmed)) return `Amendment No. ${trimmed}`;
  return trimmed;
}

export function subtractCalendarDays(
  dateValue: string | null,
  days: number | null,
) {
  if (!dateValue || !days) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
