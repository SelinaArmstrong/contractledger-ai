/**
 * Pre-execution risk is derived from open playbook findings, so an intake that
 * has never been through an AI review has no risk level at all. The register
 * queries return `null` for that case; treating it as "low" would present an
 * unreviewed draft as a cleared one.
 */

export type IntakeRiskLevel = 'high' | 'medium' | 'low';

export type IntakeRiskBadge = {
  level: IntakeRiskLevel | null;
  assessed: boolean;
  label: string;
  tone: 'rose' | 'amber' | 'green' | 'slate';
};

const riskLevels = new Set<string>(['high', 'medium', 'low']);

export function intakeRiskLevel(value: unknown): IntakeRiskLevel | null {
  return typeof value === 'string' && riskLevels.has(value)
    ? (value as IntakeRiskLevel)
    : null;
}

export function intakeRiskBadge(value: unknown): IntakeRiskBadge {
  const level = intakeRiskLevel(value);
  if (level === 'high')
    return { level, assessed: true, label: 'High risk', tone: 'rose' };
  if (level === 'medium')
    return { level, assessed: true, label: 'Medium risk', tone: 'amber' };
  if (level === 'low')
    return { level, assessed: true, label: 'Low risk', tone: 'green' };
  return { level: null, assessed: false, label: 'Not assessed', tone: 'slate' };
}

/** Caption under the badge, so "no findings" never reads like "no risk". */
export function intakeFindingSummary(
  riskValue: unknown,
  findingCount: unknown,
) {
  if (!intakeRiskLevel(riskValue)) return 'Playbook review not run';
  const count = Number(findingCount ?? 0);
  const safeCount = Number.isFinite(count) ? count : 0;
  return `${safeCount} open finding${safeCount === 1 ? '' : 's'}`;
}

export function matchesIntakeRiskFilter(value: unknown, filter: string) {
  if (filter === 'all') return true;
  const level = intakeRiskLevel(value);
  if (filter === 'unassessed') return level === null;
  if (filter === 'elevated') return level === 'high' || level === 'medium';
  return level === filter;
}

/**
 * Queue ordering for "most urgent". An unassessed intake outranks a cleared
 * one: nobody has looked at it yet, so it still needs a reviewer.
 */
export function intakeRiskRank(value: unknown) {
  const level = intakeRiskLevel(value);
  if (level === 'high') return 0;
  if (level === 'medium') return 1;
  if (level === null) return 2;
  return 3;
}
