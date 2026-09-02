import { describe, expect, it } from 'vitest';

import {
  buildReviewPackagePdf,
  reviewPackageFileName,
} from '@/lib/review-package';

describe('review package PDF', () => {
  it('creates a valid, source-aware operational review package', () => {
    const bytes = buildReviewPackagePdf({
      contract: {
        contract_number: 'CT-2026-009',
        title: 'Workplace Safety Consulting',
        supplier_name: 'Pacific Safety Consulting Inc.',
        contract_type: 'Professional Services Agreement',
        department: 'Risk & Safety',
        owner: 'Selina Armstrong',
        status: 'active',
        effective_date: '2026-03-15',
        expiration_date: '2027-03-14',
        original_value_cents: 41_000_000,
        current_value_cents: 41_000_000,
        renewal_type: 'optional',
        notice_days: 30,
      },
      findings: [
        {
          rule_name: 'Governing law',
          severity: 'high',
          status: 'accepted',
          observed_text: 'Nevada',
          standard_text: 'California',
          suggested_revision: 'Use California law.',
          source_file_name: 'agreement.pdf',
          source_page: 9,
        },
      ],
      approvals: [
        {
          rule_name: 'Legal exception',
          rule_version: 1,
          request_status: 'approved',
          reason: 'Non-standard law',
          owner_role: 'Legal Reviewer',
          action: 'approve_exception',
          actor: 'Morgan Lee',
          actor_role: 'Legal Reviewer',
          decision_at: '2026-03-14T12:00:00Z',
          decision_reason: 'Approved with operational monitoring.',
          source_page: 9,
        },
      ],
      versions: [],
      reviews: [
        {
          stage: 'executed',
          file_name: 'agreement.pdf',
          model: 'test-model',
          prompt_version: 'v1',
          correction_count: 1,
          reviewed_by: 'Selina Armstrong',
          reviewed_at: '2026-03-14T12:00:00Z',
        },
      ],
      generatedAt: '2026-09-01T12:00:00Z',
      generatedBy: 'Selina Armstrong',
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Operational Review Package');
    expect(text).toContain('Source: agreement.pdf, page 9');
    expect(text).toContain('not legal advice');
    expect(text.endsWith('%%EOF\n')).toBe(true);
  });

  it('sanitizes the downloaded file name', () => {
    expect(reviewPackageFileName('CT/2026 009')).toBe(
      'CT_2026_009_Operational_Review_Package.pdf',
    );
  });
});
