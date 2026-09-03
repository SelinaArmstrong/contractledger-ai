import {
  ArrowRight,
  AlertCircle,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const errorMessages: Record<string, string> = {
  invalid: 'The username or password is incorrect.',
  rate_limit:
    'Too many sign-in attempts. Please wait 15 minutes and try again.',
  unavailable: 'Demo sign-in has not been configured on this deployment.',
};

export function ChatGPTSignIn({
  signInPath,
  chatGPTEnabled,
  demoEnabled,
  configurationError,
  error,
}: {
  signInPath: string;
  /** False when the Sites sign-in proxy is not in front of this deployment. */
  chatGPTEnabled: boolean;
  demoEnabled: boolean;
  configurationError: string;
  error?: string;
}) {
  const errorMessage =
    configurationError || (error ? errorMessages[error] : '');
  // Never advertise a sign-in route this deployment cannot serve.
  const signInMethod = demoEnabled
    ? 'demo'
    : chatGPTEnabled
      ? 'chatgpt'
      : 'none';
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf3f6] text-[#17212b]">
      <div className="absolute inset-x-0 top-0 h-72 bg-[#0d2638]" />
      <div className="absolute left-1/2 top-0 h-72 w-[900px] -translate-x-1/2 bg-[radial-gradient(circle_at_top,rgba(73,165,198,0.28),transparent_62%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 md:px-8">
        <header className="flex items-center gap-3 text-white">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#2f86a6] shadow-lg shadow-black/15">
            <FileCheck2 className="size-5" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">
              ContractLedger AI
            </span>
            <span className="block text-[11px] text-slate-300">
              Register automation
            </span>
          </span>
        </header>

        <section className="my-auto grid overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-950/15 ring-1 ring-slate-950/10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-[#12344a] px-7 py-10 text-white md:px-12 md:py-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ed9eb]">
              <Sparkles className="size-3.5" />
              AI-assisted register operations
            </span>
            <h1 className="mt-7 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
              Contract decisions with traceable evidence.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
              Review contracts, maintain supplier qualifications, monitor key
              dates, and keep every AI-assisted decision tied to its source.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="size-5 text-[#6bc3de]" />
                <p className="mt-3 text-xs font-medium">Identity-aware audit</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Verified actions are attributed to the signed-in user.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <FileCheck2 className="size-5 text-[#6bc3de]" />
                <p className="mt-3 text-xs font-medium">Human verification</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  AI suggestions remain reviewable before register updates.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center px-7 py-10 md:px-12 md:py-14">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#e3f1f5] text-[#1d718f]">
              <LockKeyhole className="size-5" />
            </span>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#347d96]">
              Secure workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#183040]">
              Sign in to continue
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {signInMethod === 'demo'
                ? 'Use the temporary demo credentials configured for this ContractLedger workspace.'
                : signInMethod === 'chatgpt'
                  ? 'Use your ChatGPT account to access this ContractLedger workspace.'
                  : 'This deployment has no sign-in method enabled.'}
            </p>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {errorMessage}
              </div>
            ) : null}

            {signInMethod === 'demo' ? (
              <form
                action="/api/auth/login"
                method="post"
                className="mt-6 space-y-4"
              >
                <div className="block">
                  <label
                    htmlFor="demo-username"
                    className="mb-1.5 block text-xs font-medium text-[#294454]"
                  >
                    Username
                  </label>
                  <Input
                    id="demo-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={100}
                    className="h-10 bg-white"
                  />
                </div>
                <div className="block">
                  <label
                    htmlFor="demo-password"
                    className="mb-1.5 block text-xs font-medium text-[#294454]"
                  >
                    Password
                  </label>
                  <Input
                    id="demo-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={300}
                    className="h-10 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-11 w-full bg-[#1d718f] px-4 text-white hover:bg-[#185f78]',
                  )}
                >
                  Sign in to demo
                  <ArrowRight data-icon="inline-end" />
                </button>
              </form>
            ) : signInMethod === 'chatgpt' ? (
              <a
                href={signInPath}
                target="_top"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'mt-7 h-11 w-full bg-[#1d718f] px-4 text-white hover:bg-[#185f78]',
                )}
              >
                Sign in with ChatGPT
                <ArrowRight data-icon="inline-end" />
              </a>
            ) : (
              <div className="mt-7 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-xs leading-5 text-amber-900">
                <p className="font-medium">Sign-in is not configured here.</p>
                <p className="mt-1.5">
                  ChatGPT sign-in is served by OpenAI Sites and is unavailable
                  on this origin. Set <code>DEMO_GUEST_ACCESS=true</code> for
                  public read-only browsing, or configure the{' '}
                  <code>DEMO_AUTH_*</code> credentials for a signed-in
                  workspace.
                </p>
              </div>
            )}

            <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">
              {signInMethod === 'demo'
                ? 'The password stays in server-side environment secrets. The browser receives only a secure, time-limited session cookie.'
                : signInMethod === 'chatgpt'
                  ? 'Authentication is handled by OpenAI Sites. ContractLedger receives only the identity details needed for access and audit attribution.'
                  : 'All contracts, suppliers, and company policies in this workspace are fictional.'}
            </p>
          </div>
        </section>

        <footer className="mt-6 text-center text-[10px] text-slate-500">
          Fictional portfolio workspace · Not legal advice
        </footer>
      </div>
    </main>
  );
}
