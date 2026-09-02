import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import {
  GUEST_ACTOR_ID,
  authorizeApiRequest,
  guestAccessEnabled,
  guestIdentity,
  permissionsForRole,
  resolveWorkspaceRole,
  roleCan,
} from './request-security';

const originalAssignments = process.env.WORKSPACE_ROLE_ASSIGNMENTS;
const originalAdmins = process.env.DEMO_ADMIN_USER_IDS;

afterEach(() => {
  if (originalAssignments === undefined)
    delete process.env.WORKSPACE_ROLE_ASSIGNMENTS;
  else process.env.WORKSPACE_ROLE_ASSIGNMENTS = originalAssignments;
  if (originalAdmins === undefined) delete process.env.DEMO_ADMIN_USER_IDS;
  else process.env.DEMO_ADMIN_USER_IDS = originalAdmins;
});

describe('workspace role authorization', () => {
  it('denies every material write to a read-only auditor', () => {
    const writes = [
      'submit_documents',
      'edit_verified_fields',
      'edit_supplier_records',
      'approve_exceptions',
      'apply_amendments',
      'complete_obligations',
      'manage_imports',
      'run_ai_assistant',
      'manage_ai_governance',
      'reset_workspace',
    ] as const;

    expect(roleCan('read_only_auditor', 'view_documents')).toBe(true);
    expect(roleCan('read_only_auditor', 'export_data')).toBe(true);
    for (const permission of writes) {
      expect(roleCan('read_only_auditor', permission)).toBe(false);
    }
  });

  it('returns 403 from the server guard for every denied auditor write', async () => {
    delete process.env.WORKSPACE_ROLE_ASSIGNMENTS;
    delete process.env.DEMO_ADMIN_USER_IDS;
    const writes = [
      'submit_documents',
      'edit_verified_fields',
      'edit_supplier_records',
      'approve_exceptions',
      'apply_amendments',
      'complete_obligations',
      'manage_imports',
      'run_ai_assistant',
      'manage_ai_governance',
      'reset_workspace',
    ] as const;
    for (const permission of writes) {
      const result = await authorizeApiRequest(
        new Request('https://contractledger.example/api/test', {
          method: 'POST',
          headers: {
            origin: 'https://contractledger.example',
            'oai-authenticated-user-id': 'auditor-1',
            'oai-authenticated-user-email': 'auditor@example.com',
          },
        }),
        { permission },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    }
  });

  it('separates verified-field editing from exception approval', () => {
    expect(roleCan('contract_administrator', 'edit_verified_fields')).toBe(
      true,
    );
    expect(roleCan('contract_administrator', 'approve_exceptions')).toBe(false);
    expect(roleCan('approver', 'approve_exceptions')).toBe(true);
    expect(roleCan('approver', 'edit_verified_fields')).toBe(false);
  });

  it('uses configured identities and defaults hosted users to auditor', () => {
    process.env.WORKSPACE_ROLE_ASSIGNMENTS = JSON.stringify({
      'legal@example.com': 'legal_reviewer',
    });
    const base = { id: 'user-1', local: false, demo: false };
    expect(resolveWorkspaceRole({ ...base, email: 'legal@example.com' })).toBe(
      'legal_reviewer',
    );
    expect(
      resolveWorkspaceRole({ ...base, email: 'unknown@example.com' }),
    ).toBe('read_only_auditor');
  });

  it('grants administrators the complete permission catalog', () => {
    expect(permissionsForRole('administrator')).toHaveLength(13);
  });
});

describe('guest access', () => {
  const original = process.env.DEMO_GUEST_ACCESS;
  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_GUEST_ACCESS;
    else process.env.DEMO_GUEST_ACCESS = original;
  });

  it('is disabled unless the deployment opts in', () => {
    delete process.env.DEMO_GUEST_ACCESS;
    expect(guestAccessEnabled()).toBe(false);
    process.env.DEMO_GUEST_ACCESS = 'false';
    expect(guestAccessEnabled()).toBe(false);
    process.env.DEMO_GUEST_ACCESS = 'true';
    expect(guestAccessEnabled()).toBe(true);
  });

  it('gives a guest the read-only auditor role', () => {
    const guest = guestIdentity();
    expect(
      resolveWorkspaceRole({
        id: guest.userId,
        email: guest.email,
        local: false,
        demo: false,
        guest: true,
      }),
    ).toBe('read_only_auditor');
  });

  it('never elevates a guest, even one listed as a hosted admin', () => {
    process.env.DEMO_ADMIN_USER_IDS = GUEST_ACTOR_ID;
    expect(
      resolveWorkspaceRole({
        id: GUEST_ACTOR_ID,
        email: '',
        local: true,
        demo: true,
        guest: true,
      }),
    ).toBe('read_only_auditor');
    delete process.env.DEMO_ADMIN_USER_IDS;
  });

  it('withholds every write and AI permission from a guest', () => {
    const granted = permissionsForRole('read_only_auditor');
    for (const permission of [
      'submit_documents',
      'edit_verified_fields',
      'edit_supplier_records',
      'approve_exceptions',
      'apply_amendments',
      'complete_obligations',
      'manage_imports',
      'run_ai_assistant',
      'manage_ai_governance',
      'reset_workspace',
    ] as const) {
      expect(granted).not.toContain(permission);
    }
    expect(granted).toContain('view_workspace');
    expect(granted).toContain('view_documents');
  });
});
