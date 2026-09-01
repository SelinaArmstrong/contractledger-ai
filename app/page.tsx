import { cookies, headers } from 'next/headers';

import {
  chatGPTSignInPath,
  getChatGPTUser,
  type ChatGPTUser,
} from '@/app/chatgpt-auth';
import { ChatGPTSignIn } from '@/components/chatgpt-sign-in';
import { ContractLedgerApp } from '@/components/contract-ledger-app';
import {
  DEMO_SESSION_COOKIE,
  demoAuthConfigurationError,
  getDemoAuthConfig,
  verifyDemoSessionToken,
} from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

async function currentUser(): Promise<
  (ChatGPTUser & { local: boolean; demo: boolean }) | null
> {
  const user = await getChatGPTUser();
  if (user) return { ...user, local: false, demo: false };

  const cookieStore = await cookies();
  const demoSession = await verifyDemoSessionToken(
    cookieStore.get(DEMO_SESSION_COOKIE)?.value,
  );
  if (demoSession) {
    return {
      userId: `demo:${demoSession.username}`,
      displayName: demoSession.displayName,
      email: demoSession.email,
      fullName: demoSession.displayName,
      local: false,
      demo: true,
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get('host')?.toLowerCase() ?? '';
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : host.split(':', 1)[0];
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname ?? '')) return null;

  return {
    userId: 'local-demo-user',
    displayName: 'Selina Armstrong',
    email: 'local-demo@contractledger.invalid',
    fullName: 'Selina Armstrong',
    local: true,
    demo: false,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string | string[] }>;
}) {
  const user = await currentUser();
  if (!user) {
    const params = await searchParams;
    return (
      <ChatGPTSignIn
        signInPath={chatGPTSignInPath('/')}
        demoEnabled={Boolean(getDemoAuthConfig())}
        configurationError={demoAuthConfigurationError()}
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
      }}
      signOutPath={user.local ? null : '/api/auth/logout'}
    />
  );
}
