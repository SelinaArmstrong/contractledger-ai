import type { ViewName } from '@/components/workspace/types';

/**
 * URL slugs for the workbench views.
 *
 * The workbench is a single page, so without this map a view could not be
 * linked, bookmarked, or reached with the browser back button — a reviewer had
 * no way to send someone straight to the validation report. Slugs are part of
 * shared links, so treat them as stable: rename one only with a redirect.
 */
export const VIEW_SLUGS: Record<ViewName, string> = {
  Dashboard: 'dashboard',
  'New Contract Review': 'new-contract-review',
  'Approvals & Exceptions': 'approvals',
  'Bulk Import & Data Quality': 'bulk-import',
  'Contract Register': 'contracts',
  'Supplier Register': 'suppliers',
  'Obligations & Evidence': 'obligations',
  'Portfolio Case Study': 'case-study',
  'AI Accuracy & Validation': 'ai-validation',
  'Playbook & Approval Rules': 'rules',
};

export const DEFAULT_VIEW: ViewName = 'Dashboard';

const SLUG_TO_VIEW = new Map<string, ViewName>(
  Object.entries(VIEW_SLUGS).map(([view, slug]) => [slug, view as ViewName]),
);

export function slugForView(view: ViewName) {
  return VIEW_SLUGS[view];
}

/**
 * Resolves a slug from the query string. Anything unrecognised falls back to
 * the dashboard rather than erroring, so a stale or hand-edited link still
 * lands somewhere useful.
 */
export function viewForSlug(slug: unknown): ViewName {
  if (typeof slug !== 'string') return DEFAULT_VIEW;
  return SLUG_TO_VIEW.get(slug.trim().toLowerCase()) ?? DEFAULT_VIEW;
}

/** The path a view should appear at. The dashboard stays on the bare URL. */
export function pathForView(view: ViewName) {
  return view === DEFAULT_VIEW ? '/' : `/?view=${slugForView(view)}`;
}
