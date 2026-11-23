'use client';

import { useEffect, useState } from 'react';
import type { Workspace } from '@/lib/contract-ledger-types';
import type {
  RegisterOptions,
  RegisterPage,
  RegisterScope,
} from '@/lib/registers';

export function useRegisterPage(
  scope: RegisterScope,
  workspace: Workspace | null,
  criteria: string,
  page: number,
  pageSize: number,
) {
  const [result, setResult] = useState<{
    key: string;
    criteria: string;
    workspace: Workspace;
    page?: RegisterPage;
    error?: string;
  }>();
  const [options, setOptions] = useState<RegisterOptions>({});
  const [optionsError, setOptionsError] = useState('');
  const params = new URLSearchParams(criteria);
  params.set('scope', scope);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const key = params.toString();

  useEffect(() => {
    if (!workspace) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/registers?${key}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as RegisterPage & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error || 'Unable to load the register.');
        if (!controller.signal.aborted)
          setResult({ key, criteria, workspace, page: body });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key,
            criteria,
            workspace,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load the register.',
          });
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [criteria, key, workspace]);

  useEffect(() => {
    if (!workspace) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(
          `/api/registers?scope=${scope}&options=true`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error('Unable to load register filter options.');
        const body = (await response.json()) as RegisterOptions;
        if (!controller.signal.aborted) {
          setOptions(body);
          setOptionsError('');
        }
      } catch {
        if (!controller.signal.aborted)
          setOptionsError('Unable to load register filter options.');
      }
    };
    void load();
    return () => controller.abort();
  }, [scope, workspace]);

  const current =
    result?.key === key && result.workspace === workspace ? result : undefined;
  const previousPage =
    result?.criteria === criteria && result.workspace === workspace
      ? result.page
      : undefined;
  return {
    page: current?.page ?? previousPage,
    error: current?.error,
    loading: !current,
    options,
    optionsError,
  };
}
