import { headers } from 'next/headers';

import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  type ChatGPTUser,
} from '@/app/chatgpt-auth';
import { ChatGPTSignIn } from '@/components/chatgpt-sign-in';
import { ContractLedgerApp } from '@/components/contract-ledger-app';

export const dynamic = 'force-dynamic';

async function currentUser(): Promise<
  (ChatGPTUser & { local: boolean }) | null
> {
  const user = await getChatGPTUser();
  if (user) return { ...user, local: false };

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
  };
}

export default async function Home() {
  const user = await currentUser();
  if (!user) return <ChatGPTSignIn signInPath={chatGPTSignInPath('/')} />;

  return (
    <ContractLedgerApp
      currentUser={{
        displayName: user.displayName,
        email: user.email,
        local: user.local,
      }}
      signOutPath={user.local ? null : chatGPTSignOutPath('/')}
    />
  );
}
