import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VIEW,
  VIEW_SLUGS,
  pathForView,
  slugForView,
  viewForSlug,
} from '@/components/workspace/view-routing';

describe('workbench view routing', () => {
  it('round-trips every view through its slug', () => {
    for (const view of Object.keys(VIEW_SLUGS) as Array<
      keyof typeof VIEW_SLUGS
    >) {
      expect(viewForSlug(slugForView(view))).toBe(view);
    }
  });

  it('keeps slugs unique so no two views share a link', () => {
    const slugs = Object.values(VIEW_SLUGS);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses url-safe slugs', () => {
    for (const slug of Object.values(VIEW_SLUGS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(encodeURIComponent(slug)).toBe(slug);
    }
  });

  it('falls back to the dashboard for an unknown or missing slug', () => {
    expect(viewForSlug('does-not-exist')).toBe(DEFAULT_VIEW);
    expect(viewForSlug(undefined)).toBe(DEFAULT_VIEW);
    expect(viewForSlug(null)).toBe(DEFAULT_VIEW);
    expect(viewForSlug(42)).toBe(DEFAULT_VIEW);
    expect(viewForSlug(['contracts'])).toBe(DEFAULT_VIEW);
  });

  it('tolerates casing and surrounding whitespace in a shared link', () => {
    expect(viewForSlug('  AI-Validation  ')).toBe('AI Accuracy & Validation');
    expect(viewForSlug('CONTRACTS')).toBe('Contract Register');
  });

  it('keeps the dashboard on the bare path and others on a query', () => {
    expect(pathForView(DEFAULT_VIEW)).toBe('/');
    expect(pathForView('AI Accuracy & Validation')).toBe(
      '/?view=ai-validation',
    );
    expect(pathForView('Obligations & Evidence')).toBe('/?view=obligations');
  });

  it('produces a path that resolves back to the same view', () => {
    for (const view of Object.keys(VIEW_SLUGS) as Array<
      keyof typeof VIEW_SLUGS
    >) {
      const path = pathForView(view);
      const slug = new URL(path, 'https://ledger.test').searchParams.get(
        'view',
      );
      expect(viewForSlug(slug)).toBe(view);
    }
  });
});
