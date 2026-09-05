import { ChevronDown, LogIn, LogOut, UserRound } from 'lucide-react';
import { titleCase } from '@/components/workspace/formatters';

type AccountUser = {
  displayName: string;
  email: string;
  guest: boolean;
  role: string;
};

export function AccountMenu({
  currentUser,
  initials,
  signInPath,
  signOutPath,
}: {
  currentUser: AccountUser;
  initials: string;
  signInPath: string | null;
  signOutPath: string | null;
}) {
  const roleLabel = titleCase(currentUser.role.replaceAll('_', ' '));

  return (
    <div className="w-10 shrink-0 sm:w-[220px]">
      <details className="group relative">
        <summary
          aria-label={`Open account menu for ${currentUser.displayName}`}
          className="grid h-11 w-full cursor-pointer list-none grid-cols-[36px] items-center rounded-xl border border-transparent p-0 text-left outline-none transition-colors hover:border-[#dce3e8] hover:bg-slate-50 focus-visible:border-[#8ebdce] focus-visible:ring-2 focus-visible:ring-[#6aa9bd]/40 [&::-webkit-details-marker]:hidden sm:grid-cols-[36px_minmax(0,1fr)_16px] sm:gap-2 sm:px-1.5"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#d7ebf2] text-xs font-semibold text-[#17425a]">
            {initials || 'U'}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold">
              {currentUser.displayName}
            </span>
            <span className="block truncate text-[10px] text-slate-500">
              {roleLabel}
            </span>
          </span>
          <ChevronDown className="hidden size-4 text-slate-400 transition-transform group-open:rotate-180 sm:block" />
        </summary>

        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-lg bg-white p-1.5 text-slate-950 shadow-lg ring-1 ring-slate-900/10">
          <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
            Account
          </div>
          <div className="flex items-center gap-3 px-2 py-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d7ebf2] text-xs font-semibold text-[#17425a]">
              {initials || 'U'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {currentUser.displayName}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {currentUser.email || roleLabel}
              </span>
              {currentUser.email ? (
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  {roleLabel}
                </span>
              ) : null}
            </span>
          </div>
          <div className="-mx-1 my-1 h-px bg-slate-200" />

          {currentUser.guest ? (
            signInPath ? (
              <a
                href={signInPath}
                className="flex items-center gap-2 rounded-md px-2 py-2.5 outline-none hover:bg-slate-100 focus-visible:bg-slate-100"
              >
                <LogIn className="size-4 text-[#1d718f]" />
                <span>
                  <span className="block text-sm font-medium">
                    Sign in to workspace
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Use your reviewer credentials
                  </span>
                </span>
              </a>
            ) : (
              <div className="flex items-center gap-2 px-2 py-2.5 text-xs text-slate-500">
                <UserRound className="size-4" />
                Workspace sign-in is not configured.
              </div>
            )
          ) : signOutPath ? (
            <form action={signOutPath} method="post" target="_top">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm outline-none hover:bg-slate-100 focus-visible:bg-slate-100"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 px-2 py-2.5 text-xs text-slate-500">
              <UserRound className="size-4" />
              Local maintainer session
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
