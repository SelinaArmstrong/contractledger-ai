/**
 * Workspace roles and the permissions each one carries.
 *
 * This lives apart from the request-authorization code so that the account
 * configuration can name a role without importing the request pipeline, and so
 * the policy itself can be read and tested as plain data.
 */

export const workspaceRoles = [
  'requester',
  'contract_administrator',
  'legal_reviewer',
  'procurement_compliance_reviewer',
  'approver',
  'read_only_auditor',
  'demo_operator',
  'administrator',
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

export const workspacePermissions = [
  'view_workspace',
  'view_documents',
  'submit_documents',
  'edit_verified_fields',
  'edit_supplier_records',
  'approve_exceptions',
  'apply_amendments',
  'complete_obligations',
  'manage_imports',
  'run_ai_assistant',
  'manage_ai_governance',
  'export_data',
  'reset_workspace',
] as const;

export type WorkspacePermission = (typeof workspacePermissions)[number];

const permissionPolicy: Record<
  WorkspaceRole,
  ReadonlySet<WorkspacePermission>
> = {
  requester: new Set(['view_workspace', 'view_documents', 'submit_documents']),
  contract_administrator: new Set([
    'view_workspace',
    'view_documents',
    'submit_documents',
    'edit_verified_fields',
    'edit_supplier_records',
    'apply_amendments',
    'complete_obligations',
    'manage_imports',
    'run_ai_assistant',
    'manage_ai_governance',
    'export_data',
  ]),
  legal_reviewer: new Set([
    'view_workspace',
    'view_documents',
    'approve_exceptions',
    'run_ai_assistant',
  ]),
  procurement_compliance_reviewer: new Set([
    'view_workspace',
    'view_documents',
    'submit_documents',
    'edit_supplier_records',
    'approve_exceptions',
    'complete_obligations',
    'run_ai_assistant',
  ]),
  approver: new Set(['view_workspace', 'view_documents', 'approve_exceptions']),
  read_only_auditor: new Set([
    'view_workspace',
    'view_documents',
    'export_data',
  ]),
  /**
   * The reviewer account. It can walk every contract-operations workflow end
   * to end — including approvals, so a reviewer sees both sides of the
   * separation-of-duties design — but it deliberately cannot reset the
   * workspace: the credentials are shared with more than one reviewer, and a
   * reset would wipe the records another is part-way through.
   */
  demo_operator: new Set([
    'view_workspace',
    'view_documents',
    'submit_documents',
    'edit_verified_fields',
    'edit_supplier_records',
    'approve_exceptions',
    'apply_amendments',
    'complete_obligations',
    'manage_imports',
    'run_ai_assistant',
    'manage_ai_governance',
    'export_data',
  ]),
  administrator: new Set(workspacePermissions),
};

export function roleCan(role: WorkspaceRole, permission: WorkspacePermission) {
  return permissionPolicy[role].has(permission);
}

export function permissionsForRole(role: WorkspaceRole) {
  return workspacePermissions.filter((permission) => roleCan(role, permission));
}
