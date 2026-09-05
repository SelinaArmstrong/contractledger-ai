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
  localMaintainerRequest,
} from '@/lib/server/request-security';
import { permissionsForRole, type WorkspaceRole } from '@/lib/workspace-roles';
import { GUEST_NOTICE_DISMISSED_COOKIE } from '@/lib/ui-preferences';

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

  // The loopback shortcut is an explicit opt-in rather than a property of the
  // request, because `Host` is client-supplied. See `localMaintainerRequest`.
  const requestHeaders = await headers();
  if (localMaintainerRequest(requestHeaders.get('host'))) {
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
    login?: string | string[];
    view?: string | string[];
  }>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const signInEnabled = signInAvailable();
  const signInRequested =
    user?.guest &&
    (Array.isArray(params.login) ? params.login[0] : params.login) === '1';
  if (!user || signInRequested) {
    return (
      <WorkspaceSignIn
        configurationError={workspaceAuthConfigurationError()}
        signInEnabled={signInEnabled}
        guestBrowsePath={guestAccessEnabled() ? '/' : null}
        error={
          typeof params.auth_error === 'string' ? params.auth_error : undefined
        }
      />
    );
  }

  const cookieStore = await cookies();

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
      signInPath={user.guest && signInEnabled ? '/?login=1' : null}
      signOutPath={user.local || user.guest ? null : '/api/auth/logout'}
      showGuestNoticeInitially={
        cookieStore.get(GUEST_NOTICE_DISMISSED_COOKIE)?.value !== '1'
      }
      initialView={viewForSlug(
        Array.isArray(params.view) ? params.view[0] : params.view,
      )}
    />
  );
}
