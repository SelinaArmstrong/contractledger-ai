import { cookies, headers } from 'next/headers';

import { ContractLedgerApp } from '@/components/contract-ledger-app';
import { WorkspaceSignIn } from '@/components/workspace-sign-in';
import { viewForSlug } from '@/components/workspace/view-routing';
import {
  DEMO_SESSION_COOKIE,
  signInAvailable,
  verifyDemoSessionToken,
  workspaceAuthConfigurationError,
} from '@/lib/workspace-auth';
import {
  guestAccessEnabled,
  guestIdentity,
} from '@/lib/server/request-security';
import { permissionsForRole, type WorkspaceRole } from '@/lib/workspace-roles';

export const dynamic = 'force-dynamic';

type CurrentUser = {
  displayName: string;
  email: string;
  local: boolean;
  demo: boolean;
  guest: boolean;
  role: WorkspaceRole;
  permissions: ReturnType<typeof permissionsForRole>;
};

/**
 * Resolves the viewer for the page shell. A signed session wins over the
 * loopback shortcut so the maintainer can sign in locally as the demo role and
 * see exactly what a reviewer sees.
 */
async function currentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = await verifyDemoSessionToken(
    cookieStore.get(DEMO_SESSION_COOKIE)?.value,
  );
  if (session) {
    return {
      displayName: session.displayName,
      email: session.email,
      local: false,
      demo: true,
      guest: false,
      role: session.role,
      permissions: permissionsForRole(session.role),
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get('host')?.toLowerCase() ?? '';
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : host.split(':', 1)[0];

  if (['localhost', '127.0.0.1', '::1'].includes(hostname ?? '')) {
    return {
      displayName: 'Local maintainer',
      email: 'local@contractledger.invalid',
      local: true,
      demo: false,
      guest: false,
      role: 'administrator',
      permissions: permissionsForRole('administrator'),
    };
  }

  // A public portfolio deployment can let reviewers browse without an account.
  if (!guestAccessEnabled()) return null;
  const guest = guestIdentity();
  return {
    displayName: guest.displayName,
    email: guest.email,
    local: false,
    demo: false,
    guest: true,
    role: 'read_only_auditor',
    permissions: permissionsForRole('read_only_auditor'),
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    auth_error?: string | string[];
    view?: string | string[];
  }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  if (!user) {
    return (
      <WorkspaceSignIn
        configurationError={workspaceAuthConfigurationError()}
        signInEnabled={signInAvailable()}
        error={
          typeof params.auth_error === 'string' ? params.auth_error : undefined
        }
      />
    );
  }

  return (
    <ContractLedgerApp
      currentUser={{
        displayName: user.displayName,
        email: user.email,
        local: user.local,
        demo: user.demo,
        guest: user.guest,
        role: user.role,
        permissions: user.permissions,
      }}
      signOutPath={user.local || user.guest ? null : '/api/auth/logout'}
      initialView={viewForSlug(
        Array.isArray(params.view) ? params.view[0] : params.view,
      )}
    />
  );
}
