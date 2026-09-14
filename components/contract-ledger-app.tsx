'use client';

import type { WorkspaceRole } from '@/lib/workspace-roles';

import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from '@/lib/contract-ledger-types';
import { exportCurrentRegisters } from '@/lib/export-registers';
import {
  AlertCircle,
  BellRing,
  Check,
  Database,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIAssistantDialog } from '@/components/dialogs/ai-assistant-dialog';
import { IntakeReviewDialog } from '@/components/dialogs/intake-review-dialog';
import { RecordDetailDialog } from '@/components/dialogs/record-detail-dialog';
import { SupplierOnboardingDialog } from '@/components/dialogs/supplier-onboarding-dialog';
import { AIEvaluationView } from '@/components/views/ai-evaluation-view';
import { ApprovalQueueView } from '@/components/views/approval-queue-view';
import { BulkImportView } from '@/components/views/bulk-import-view';
import { ContractRegisterView } from '@/components/views/contract-register-view';
import { DashboardView } from '@/components/views/dashboard-view';
import { NewContractReviewView } from '@/components/views/new-contract-review-view';
import { AlertsExportsView } from '@/components/views/obligations-view';
import { PlaybookRulesView } from '@/components/views/playbook-rules-view';
import { PortfolioCaseStudyView } from '@/components/views/portfolio-case-study-view';
import { SupplierRegisterView } from '@/components/views/supplier-register-view';
import { AnalysisReview } from '@/components/workspace/analysis-review';
import { DraftIntakePanel } from '@/components/workspace/draft-intake-panel';
import {
  dialogSurfaceClass,
  navItems,
  navigationGroups,
} from '@/components/workspace/constants';
import {
  LiveStatus,
  SkipToContentLink,
  StatusBadge,
} from '@/components/workspace/primitives';
import type {
  DetailSelection,
  IntakeStage,
  ViewName,
} from '@/components/workspace/types';
import {
  WORKSPACE_REGISTER_LIMIT,
  registerTruncation,
} from '@/lib/workspace-limits';
import { pathForView, viewForSlug } from '@/components/workspace/view-routing';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';
import { useIntakeWorkflow } from '@/components/workspace/use-intake-workflow';
import type { IntakeSaveResult } from '@/components/workspace/use-intake-workflow';
import { AccountMenu } from '@/components/workspace/account-menu';
import { GUEST_NOTICE_DISMISSED_COOKIE } from '@/lib/ui-preferences';

const workspaceContentId = 'workspace-content';

export function ContractLedgerApp({
  currentUser,
  signInPath,
  signOutPath,
  showGuestNoticeInitially,
  initialView,
}: {
  currentUser: {
    displayName: string;
    email: string;
    local: boolean;
    demo: boolean;
    guest: boolean;
    role: WorkspaceRole;
    permissions: string[];
  };
  signInPath: string | null;
  signOutPath: string | null;
  showGuestNoticeInitially: boolean;
  /** Resolved on the server from `?view=`, so a deep link renders directly. */
  initialView: ViewName;
}) {
  const [activeView, setActiveViewState] = useState<ViewName>(initialView);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const [intakeDetailId, setIntakeDetailId] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [showGuestNotice, setShowGuestNotice] = useState(
    showGuestNoticeInitially,
  );
  const [managementInsightsRequest, setManagementInsightsRequest] = useState<
    'contracts' | 'suppliers' | null
  >(null);
  /** Rule to highlight when the reader arrives from a finding or a decision. */
  const [focusRuleKey, setFocusRuleKey] = useState<string | null>(null);
  const intakeDialogRef = useRef<HTMLDialogElement>(null);
  const intakeDialogDrag = useDraggableDialog({
    surfaceRef: intakeDialogRef,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const userInitials = currentUser.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const can = (permission: string) =>
    currentUser.permissions.includes(permission);

  const dismissGuestNotice = useCallback(() => {
    document.cookie = `${GUEST_NOTICE_DISMISSED_COOKIE}=1; Path=/; Max-Age=315360000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    setShowGuestNotice(false);
  }, []);

  useEffect(() => {
    const openAssistantShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setAssistantOpen(true);
      }
    };
    window.addEventListener('keydown', openAssistantShortcut);
    return () => window.removeEventListener('keydown', openAssistantShortcut);
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace');
      const body = (await response.json()) as Workspace & { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'The workspace could not be loaded.');
      setWorkspace(body);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : 'The workspace could not be loaded.',
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const exportRegisters = async () => {
    if (!workspace) return;
    setExporting(true);
    try {
      const authorization = await fetch('/api/exports/authorize', {
        method: 'POST',
      });
      const result = (await authorization.json()) as { error?: string };
      if (!authorization.ok)
        throw new Error(result.error || 'Export is not permitted.');
      await exportCurrentRegisters(workspace);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Export is not permitted.',
      );
    } finally {
      setExporting(false);
    }
  };

  const exportSuppliers = async () => {
    if (!workspace) return;
    setExporting(true);
    try {
      const authorization = await fetch('/api/exports/authorize', {
        method: 'POST',
      });
      const result = (await authorization.json()) as { error?: string };
      if (!authorization.ok)
        throw new Error(result.error || 'Export is not permitted.');
      await exportCurrentRegisters(workspace, 'suppliers');
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Export is not permitted.',
      );
    } finally {
      setExporting(false);
    }
  };

  const resetDemo = async () => {
    if (
      !window.confirm(
        'Reset all local demo changes and restore the original fictional records?',
      )
    )
      return;
    setResetting(true);
    setWorkspaceError('');
    try {
      const response = await fetch('/api/workspace/reset', { method: 'POST' });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'The demo could not be reset.');
      setWorkspace(body.workspace);
      setDetail(null);
      setSearch('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'The demo could not be reset.',
      );
    } finally {
      setResetting(false);
    }
  };

  const counts = {
    review:
      workspace?.intakes.filter((item) => item.review_status !== 'complete')
        .length ?? 0,
    alerts:
      (workspace?.keyDates.filter((item) => item.status !== 'completed')
        .length ?? 0) + (workspace?.supplierAlerts.length ?? 0),
    approvals: workspace?.approvalMetrics.open_requests ?? 0,
  };

  const navCount = (label: ViewName) => {
    if (label === 'New Contract Review') return counts.review;
    if (label === 'Approvals & Exceptions') return counts.approvals;
    if (label === 'Obligations & Evidence') return counts.alerts;
    return 0;
  };
  const mobilePrimaryViews: ViewName[] = [
    'Dashboard',
    'New Contract Review',
    'Approvals & Exceptions',
  ];
  const mobilePrimaryItems = navItems.filter((item) =>
    mobilePrimaryViews.includes(item.label),
  );
  const mobileSecondaryItems = navItems.filter(
    (item) => !mobilePrimaryViews.includes(item.label),
  );
  const mobileNavLabel = (label: ViewName) => {
    if (label === 'New Contract Review') return 'Reviews';
    if (label === 'Approvals & Exceptions') return 'Approvals';
    if (label === 'Obligations & Evidence') return 'Obligations';
    return label;
  };

  const filteredContracts = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!workspace || !query) return workspace?.contracts ?? [];
    return workspace.contracts.filter((item) =>
      [
        item.contract_number,
        item.title,
        item.supplier_name,
        item.contract_type,
        item.department,
        item.owner,
        item.status,
        item.effective_date,
        item.expiration_date,
        item.payment_terms,
        item.governing_law,
        typeof item.current_value_cents === 'number'
          ? String(item.current_value_cents / 100)
          : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, workspace]);

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!workspace || !query) return workspace?.suppliers ?? [];
    return workspace.suppliers.filter((item) =>
      [
        item.vendor_number,
        item.legal_name,
        item.dba_name,
        item.category,
        item.status,
        item.primary_contact,
        item.email,
        item.phone,
        item.city,
        item.state,
        item.tax_classification,
        item.risk_tier,
        item.qualification_status,
        item.relationship_stage,
        item.linked_contracts,
        item.linked_intakes,
        typeof item.total_contract_value_cents === 'number'
          ? String(item.total_contract_value_cents / 100)
          : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, workspace]);

  /**
   * Switching views is a navigation: it pushes a history entry so the view can
   * be linked and the browser back button moves between views rather than
   * leaving the application.
   */
  // Tracked in a ref so the history entry is pushed exactly once per
  // navigation; pushing from inside a state updater would double-fire under
  // StrictMode's repeated invocation.
  const activeViewRef = useRef(initialView);
  const setActiveView = useCallback((view: ViewName) => {
    if (activeViewRef.current === view) return;
    activeViewRef.current = view;
    window.history.pushState({ view }, '', pathForView(view));
    setActiveViewState(view);
  }, []);

  // Back and forward move through the views pushed above.
  useEffect(() => {
    const onPopState = () => {
      const slug = new URLSearchParams(window.location.search).get('view');
      const view = viewForSlug(slug);
      activeViewRef.current = view;
      setActiveViewState(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /**
   * The executed-contract dialog and the inline draft workspace run the same
   * upload → extract → verify flow, but they keep separate state so switching
   * views never discards half-finished work in the other one.
   */
  const handleIntakeSaved = useCallback(
    (result: IntakeSaveResult) => {
      setWorkspace(result.workspace);
      if (result.stage === 'executed' && result.registeredContract) {
        setActiveView('Contract Register');
        setSearch(result.registeredContract.contractNumber);
        setDialogOpen(false);
        return true;
      }
      return false;
    },
    [setActiveView],
  );
  const dialogIntake = useIntakeWorkflow({
    initialStage: 'draft',
    onSaved: handleIntakeSaved,
  });
  const draftIntake = useIntakeWorkflow({
    initialStage: 'draft',
    onSaved: handleIntakeSaved,
  });
  const {
    analysisError,
    analysisResult,
    analysisStatus,
    fieldOverrideReasons,
    fieldReviews,
    missingOverrideCount,
    originalAnalysis,
    pendingReviewCount,
    previewUrl: selectedFilePreviewUrl,
    selectedFile,
    stage,
  } = dialogIntake;

  const openRuleReference = (ruleKey: string) => {
    setFocusRuleKey(ruleKey);
    setActiveView('Playbook & Approval Rules');
  };

  const openIntake = (nextStage: IntakeStage) => {
    dialogIntake.begin(nextStage);
    setDialogOpen(true);
  };

  // Each register snapshot in the workspace payload is capped, so the views
  // need to know when they are showing a partial list.
  const contractTruncation = registerTruncation(
    workspace?.contracts.length ?? 0,
    Number(workspace?.metrics.total_contracts ?? 0),
    Number(workspace?.registerLimit ?? WORKSPACE_REGISTER_LIMIT),
  );
  const supplierTruncation = registerTruncation(
    workspace?.suppliers.length ?? 0,
    Number(workspace?.metrics.total_suppliers ?? 0),
    Number(workspace?.registerLimit ?? WORKSPACE_REGISTER_LIMIT),
  );

  // Long-running work happens without a navigation, so the live region below
  // is the only signal a screen reader gets that the workspace is busy.
  const activityMessage = useMemo(() => {
    if (workspaceError) return `Workspace unavailable. ${workspaceError}`;
    if (resetting) return 'Resetting the demonstration workspace.';
    if (exporting) return 'Preparing the register export.';
    if (
      analysisStatus === 'analyzing' ||
      draftIntake.analysisStatus === 'analyzing'
    )
      return 'Analyzing the document.';
    if (analysisStatus === 'saving' || draftIntake.analysisStatus === 'saving')
      return 'Saving the verified record.';
    if (analysisStatus === 'saved' || draftIntake.analysisStatus === 'saved')
      return 'The verified record was saved.';
    const failure = analysisError || draftIntake.analysisError;
    if (failure) return `Analysis failed. ${failure}`;
    return '';
  }, [
    analysisError,
    analysisStatus,
    draftIntake.analysisError,
    draftIntake.analysisStatus,
    exporting,
    resetting,
    workspaceError,
  ]);

  return (
    <main className="contract-ledger-app min-h-screen bg-background text-foreground">
      <SkipToContentLink targetId={workspaceContentId} />
      <LiveStatus message={activityMessage} />
      <LiveStatus message={`${activeView} view`} />
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-20 hidden w-[272px] bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-[88px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/15">
            <BrandMark />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              ContractLedger AI
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              Contract & supplier operations
            </div>
          </div>
        </div>

        <nav
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6 [scrollbar-gutter:stable]"
          aria-label="Primary navigation"
        >
          {navigationGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex ? 'pt-5' : ''}>
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const count = navCount(item.label);
                  const active = activeView === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setActiveView(item.label);
                        setSearch('');
                      }}
                      aria-current={active ? 'page' : undefined}
                      title={item.label}
                      className={`workspace-nav-item grid min-h-11 w-full grid-cols-[18px_minmax(0,1fr)_24px] items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-slate-300 hover:bg-sidebar-accent hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`size-[17px] ${active ? 'text-sidebar-primary-foreground' : 'text-slate-400'}`}
                      />
                      <span className="min-w-0 leading-[1.4]">
                        {item.label}
                      </span>
                      <span
                        aria-hidden={!count}
                        className={`flex h-5 min-w-6 items-center justify-center rounded-md px-1 text-[10px] tabular-nums ${count ? (active ? 'bg-sidebar/10 text-sidebar' : 'bg-white/8 text-slate-300') : 'invisible'}`}
                      >
                        {count || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-card/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="size-4 text-[#62c0dc]" />
            Demo workspace
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            <Link
              href="/about"
              className="mb-2 block text-slate-200 underline underline-offset-4"
            >
              About this project
            </Link>
            All contracts, suppliers, and company policies are fictional.
          </p>
        </div>
      </aside>

      <div className="workspace-shell lg:pl-[272px]">
        <header className="workspace-topbar sticky top-0 z-10 flex h-[88px] items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex shrink-0 items-center gap-3 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#12344a] text-white">
                <BrandMark className="size-9" />
              </div>
              <span className="hidden text-sm font-semibold sm:inline">
                ContractLedger AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              aria-label="Open AI Contract Operations Assistant"
              className="workspace-assistant-trigger group flex h-10 min-w-0 max-w-[480px] flex-1 items-center gap-3 rounded-lg border border-border bg-card px-3 text-left transition hover:border-ring hover:bg-card"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Sparkles className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                Ask about your contracts, suppliers or renewals…
              </span>
              <span className="hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:inline">
                ⌘ K
              </span>
            </button>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('Obligations & Evidence')}
              aria-label="Notifications"
              className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-slate-600"
            >
              <BellRing className="size-4" />
              {counts.alerts ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[11px] font-semibold text-white">
                  {counts.alerts}
                </span>
              ) : null}
            </button>
            <AccountMenu
              currentUser={currentUser}
              initials={userInitials}
              signInPath={signInPath}
              signOutPath={signOutPath}
            />
          </div>
        </header>

        <div className="workspace-mobile-nav border-b border-border bg-background px-3 py-2 lg:hidden">
          <nav
            className="flex items-center gap-1"
            aria-label="Mobile navigation"
          >
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {mobilePrimaryItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveView(item.label)}
                  aria-current={activeView === item.label ? 'page' : undefined}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${activeView === item.label ? 'bg-accent font-medium text-accent-foreground' : 'text-slate-500'}`}
                >
                  {mobileNavLabel(item.label)}
                  {navCount(item.label) ? (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {navCount(item.label)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  mobileSecondaryItems.some((item) => item.label === activeView)
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-slate-500'
                }`}
              >
                <MoreHorizontal className="size-4" /> More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>More workspace views</DropdownMenuLabel>
                  {mobileSecondaryItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        onClick={() => setActiveView(item.label)}
                        className="gap-2 px-2 py-2"
                      >
                        <Icon className="size-4 text-slate-500" />
                        <span className="flex-1">{item.label}</span>
                        {activeView === item.label ? (
                          <Check className="size-4 text-accent-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div
          id={workspaceContentId}
          tabIndex={-1}
          className="workspace-content mx-auto w-full max-w-[1660px] px-4 py-7 md:px-7 md:py-9 xl:px-9"
        >
          {currentUser.guest && showGuestNotice ? (
            <Alert className="mb-6 border-border bg-accent text-foreground">
              <ShieldCheck />
              <AlertTitle>Read-only public demo</AlertTitle>
              <AlertDescription>
                You are browsing every register, approval, obligation and
                validation record with read-only access. Uploading documents,
                recording decisions and running AI analysis require a signed-in
                workspace role. All organisations, people and agreements shown
                here are fictional.
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={dismissGuestNotice}
                  aria-label="Dismiss the read-only public demo notice permanently"
                  title="Don’t show this notice again"
                  className="text-sky-700 hover:bg-sky-100 hover:text-sky-950"
                >
                  <X />
                </Button>
              </AlertAction>
            </Alert>
          ) : null}
          {workspaceError ? (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle />
              <AlertTitle>Workspace unavailable</AlertTitle>
              <AlertDescription>{workspaceError}</AlertDescription>
            </Alert>
          ) : null}
          {activeView === 'Dashboard' ? (
            <DashboardView
              workspace={workspace}
              onOpen={openIntake}
              onNavigate={setActiveView}
              onReset={resetDemo}
              resetting={resetting}
              canReset={can('reset_workspace')}
            />
          ) : null}
          {activeView === 'New Contract Review' ? (
            <NewContractReviewView
              workspace={workspace}
              intakePanel={<DraftIntakePanel intake={draftIntake} />}
              canEditWorkflow={can('edit_verified_fields')}
              onSelectIntake={setIntakeDetailId}
              onUpdated={setWorkspace}
            />
          ) : null}
          {activeView === 'Approvals & Exceptions' ? (
            <ApprovalQueueView
              currentRole={currentUser.role}
              workspace={workspace}
              onUpdated={setWorkspace}
              onOpenIntake={setIntakeDetailId}
              onOpenRule={openRuleReference}
            />
          ) : null}
          {activeView === 'Bulk Import & Data Quality' ? (
            <BulkImportView workspace={workspace} onUpdated={setWorkspace} />
          ) : null}
          {activeView === 'Contract Register' ? (
            <ContractRegisterView
              contracts={filteredContracts}
              allContracts={workspace?.contracts ?? []}
              recentContracts={workspace?.contracts.slice(0, 5) ?? []}
              search={search}
              onSearch={setSearch}
              onRegister={() => openIntake('executed')}
              onExport={exportRegisters}
              exporting={exporting}
              onSelect={(id) => setDetail({ type: 'contract', id })}
              onOpenAlerts={() => setActiveView('Obligations & Evidence')}
              openInsightsRequest={managementInsightsRequest === 'contracts'}
              onInsightsRequestHandled={() =>
                setManagementInsightsRequest(null)
              }
              truncation={contractTruncation}
            />
          ) : null}
          {activeView === 'Supplier Register' ? (
            <SupplierRegisterView
              suppliers={filteredSuppliers}
              allSuppliers={workspace?.suppliers ?? []}
              riskProfiles={workspace?.supplierRiskProfiles ?? {}}
              search={search}
              onSearch={setSearch}
              onSelect={(id) => setDetail({ type: 'supplier', id })}
              onAdd={() => setSupplierDialogOpen(true)}
              onExport={exportSuppliers}
              exporting={exporting}
              onOpenAlerts={() => setActiveView('Obligations & Evidence')}
              openInsightsRequest={managementInsightsRequest === 'suppliers'}
              onInsightsRequestHandled={() =>
                setManagementInsightsRequest(null)
              }
              truncation={supplierTruncation}
            />
          ) : null}
          {activeView === 'Obligations & Evidence' ? (
            <AlertsExportsView
              workspace={workspace}
              onExport={exportRegisters}
              exporting={exporting}
              onRefresh={loadWorkspace}
              onSelectContract={(id) => setDetail({ type: 'contract', id })}
              onSelectSupplier={(id) => setDetail({ type: 'supplier', id })}
            />
          ) : null}
          {activeView === 'Playbook & Approval Rules' ? (
            <PlaybookRulesView
              workspace={workspace}
              focusRuleKey={focusRuleKey}
              onFocusHandled={() => setFocusRuleKey(null)}
            />
          ) : null}
          {activeView === 'Portfolio Case Study' ? (
            <PortfolioCaseStudyView
              workspace={workspace}
              onNavigate={setActiveView}
              canRecordTimings={can('manage_ai_governance')}
            />
          ) : null}
          {activeView === 'AI Accuracy & Validation' ? (
            <AIEvaluationView
              workspace={workspace}
              onCompleted={(nextWorkspace) => setWorkspace(nextWorkspace)}
            />
          ) : null}
        </div>
      </div>

      <AIAssistantDialog
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        onOpenRecord={(record) => {
          const target = record.openTarget;
          if (!target) return;
          setAssistantOpen(false);
          if (target.type === 'intake') {
            setActiveView('New Contract Review');
            setIntakeDetailId(target.id);
            return;
          }
          setActiveView(
            target.type === 'contract'
              ? 'Contract Register'
              : 'Supplier Register',
          );
          setDetail({ type: target.type, id: target.id });
        }}
        onOpenManagementInsights={(scope) => {
          setAssistantOpen(false);
          setSearch('');
          setManagementInsightsRequest(scope);
          setActiveView(
            scope === 'contracts' ? 'Contract Register' : 'Supplier Register',
          );
        }}
      />

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <dialog
            ref={intakeDialogRef}
            style={intakeDialogDrag.surfaceStyle}
            onPointerDown={intakeDialogDrag.onPointerDown}
            onPointerMove={intakeDialogDrag.onPointerMove}
            onPointerUp={intakeDialogDrag.onPointerUp}
            onPointerCancel={intakeDialogDrag.onPointerCancel}
            open
            aria-modal="true"
            aria-labelledby="intake-dialog-title"
            className={`${dialogSurfaceClass} grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden`}
          >
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              aria-label="Close intake dialog"
              className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              ×
            </button>
            <div
              data-dialog-drag-handle
              title="Drag to move dialog"
              className="cursor-move touch-none select-none border-b border-border px-6 py-4"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                <Sparkles className="size-3.5" />
                DeepSeek document extraction
              </div>
              <h2
                id="intake-dialog-title"
                className="text-lg font-medium leading-none"
              >
                {stage === 'draft'
                  ? 'Review a new contract'
                  : 'Register an executed contract'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {stage === 'draft'
                  ? 'Extract proposed fields and playbook differences. Nothing will enter the official contract register.'
                  : 'Extract official signed data, verify it, and add the record to the contract and supplier registers.'}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ['01', 'Source document', 'Upload the complete agreement'],
                  ['02', 'AI extraction', 'Trace values and terms to pages'],
                  [
                    '03',
                    'Human verification',
                    'Confirm before database update',
                  ],
                ].map(([number, title, description]) => (
                  <div
                    key={number}
                    className="rounded-lg border border-[#d9e6eb] bg-muted px-3 py-2"
                  >
                    <span className="text-[11px] font-semibold text-accent-foreground">
                      STEP {number}
                    </span>
                    <span className="ml-2 text-[11px] font-semibold text-foreground">
                      {title}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      {description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden">
              {analysisStatus === 'saved' ? (
                <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-6" />
                  </span>
                  <h3 className="text-base font-semibold">
                    Verified record saved
                  </h3>
                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                    {stage === 'draft'
                      ? 'The draft is now in the review queue and its proposed amount remains outside the official register.'
                      : 'The executed agreement now appears in both the official contract register and its linked supplier record.'}
                  </p>
                  <Button className="mt-5" onClick={() => setDialogOpen(false)}>
                    Return to workspace
                  </Button>
                </div>
              ) : (
                <div className="grid h-full min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <section className="min-h-0 overflow-y-auto border-b border-border bg-muted px-5 py-4 xl:border-b-0 xl:border-r">
                    <div className="rounded-xl border-2 border-dashed border-border bg-card p-4">
                      <input
                        ref={fileInput}
                        type="file"
                        accept=".pdf,.txt,application/pdf,text/plain"
                        className="sr-only"
                        onChange={(event) =>
                          dialogIntake.selectFile(
                            event.target.files?.[0] ?? null,
                          )
                        }
                      />
                      <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                        <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:mb-0 sm:mr-4">
                          <Upload className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {selectedFile
                              ? selectedFile.name
                              : stage === 'executed'
                                ? 'Choose the fully executed agreement'
                                : 'Choose a draft contract'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Text-based PDF or TXT · maximum 8 MB · demo files
                            only
                          </p>
                        </div>
                        <div className="mt-4 flex gap-2 sm:mt-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-card"
                            onClick={() => void dialogIntake.loadDemoDocument()}
                          >
                            Use demo PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-card"
                            onClick={() => fileInput.current?.click()}
                          >
                            {selectedFile ? 'Replace file' : 'Browse files'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted">
                      <div className="border-b border-border bg-card px-4 py-3">
                        <h3 className="text-xs font-semibold text-foreground">
                          {stage === 'executed'
                            ? 'Executed source copy'
                            : 'Draft source copy'}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Verify the source while reviewing extracted values on
                          the right.
                        </p>
                      </div>
                      {selectedFilePreviewUrl ? (
                        <iframe
                          title={
                            selectedFile?.name ?? 'Contract source preview'
                          }
                          src={selectedFilePreviewUrl}
                          className="h-[52vh] min-h-[430px] w-full bg-card"
                        />
                      ) : (
                        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                          <FileText className="size-7 text-slate-300" />
                          <p className="mt-3 text-xs font-medium text-slate-600">
                            {selectedFile
                              ? 'Text file selected; AI results will appear on the right.'
                              : 'Select a contract document to preview it here.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="min-h-0 overflow-y-auto px-5 py-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          AI extraction and human verification
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Database values remain unchanged until every field is
                          confirmed.
                        </p>
                      </div>
                      <StatusBadge tone={analysisResult ? 'green' : 'amber'}>
                        {analysisResult
                          ? 'Ready to verify'
                          : 'Waiting for analysis'}
                      </StatusBadge>
                    </div>
                    {stage === 'executed' ? (
                      <div className="mb-4 space-y-2">
                        <label
                          htmlFor="executed-review-intake"
                          className="text-xs font-semibold"
                        >
                          Corresponding review intake
                        </label>
                        <select
                          id="executed-review-intake"
                          value={dialogIntake.intakeId}
                          onChange={(event) =>
                            dialogIntake.setIntakeId(event.target.value)
                          }
                          className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs"
                        >
                          <option value="">
                            No prior intake (only when no approvals are
                            required)
                          </option>
                          {workspace?.intakes
                            .filter((item) =>
                              [
                                'draft',
                                'under_review',
                                'revision_requested',
                                'approved_for_signature',
                              ].includes(String(item.status)),
                            )
                            .map((item) => (
                              <option
                                key={String(item.id)}
                                value={String(item.id)}
                              >
                                {String(item.intake_number)} ·{' '}
                                {String(item.proposed_supplier_name)} ·{' '}
                                {String(item.title)}
                              </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-600">
                          Select the review for this exact agreement. Changed
                          terms require a new draft review and approvals before
                          registration.
                        </p>
                      </div>
                    ) : null}
                    {analysisStatus === 'analyzing' ? (
                      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-border bg-card text-center">
                        <LoaderCircle className="size-7 animate-spin text-accent-foreground" />
                        <p className="mt-3 text-sm font-medium">
                          Extracting traceable contract fields…
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          DeepSeek is treating the uploaded document as
                          untrusted source data.
                        </p>
                      </div>
                    ) : null}
                    {analysisError ? (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle />
                        <AlertTitle>Analysis needs attention</AlertTitle>
                        <AlertDescription>{analysisError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {analysisResult && analysisStatus !== 'analyzing' ? (
                      <AnalysisReview
                        result={analysisResult}
                        originalAnalysis={originalAnalysis}
                        stage={stage}
                        fieldReviews={fieldReviews}
                        fieldOverrideReasons={fieldOverrideReasons}
                        onOverrideReasonChange={dialogIntake.setOverrideReason}
                        onFieldChange={dialogIntake.updateField}
                        onConfirmField={dialogIntake.confirmField}
                        onConfirmAll={dialogIntake.confirmAllUnchangedFields}
                      />
                    ) : analysisStatus !== 'analyzing' ? (
                      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted px-6 text-center">
                        <Sparkles className="size-7 text-[#72a9ba]" />
                        <p className="mt-3 text-xs font-semibold text-foreground">
                          Upload the source document first
                        </p>
                        <p className="mt-1 max-w-sm text-[11px] leading-4 text-slate-500">
                          Analyze the file to extract register fields, source
                          pages, key dates, and playbook differences.
                        </p>
                      </div>
                    ) : null}
                  </section>
                </div>
              )}
            </div>

            {analysisStatus !== 'saved' ? (
              <div className="flex flex-col-reverse gap-2 border-t border-border bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                {analysisResult ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={dialogIntake.clearAnalysis}
                    >
                      Start over
                    </Button>
                    <Button
                      onClick={() => void dialogIntake.save()}
                      disabled={
                        analysisStatus === 'saving' ||
                        pendingReviewCount > 0 ||
                        missingOverrideCount > 0
                      }
                      className="bg-primary hover:bg-primary/90"
                    >
                      {analysisStatus === 'saving' ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Database />
                      )}{' '}
                      {stage === 'draft'
                        ? pendingReviewCount
                          ? `Confirm ${pendingReviewCount} fields to save`
                          : 'Save reviewed intake'
                        : pendingReviewCount
                          ? `Confirm ${pendingReviewCount} fields to save`
                          : 'Add verified data to registers'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => void dialogIntake.analyze()}
                    disabled={!selectedFile || analysisStatus === 'analyzing'}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Sparkles />
                    Analyze with DeepSeek
                  </Button>
                )}
              </div>
            ) : null}
          </dialog>
        </div>
      ) : null}
      <SupplierOnboardingDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={(nextWorkspace, supplierName) => {
          setWorkspace(nextWorkspace);
          setSearch(supplierName);
        }}
      />
      {intakeDetailId ? (
        <IntakeReviewDialog
          intakeId={intakeDetailId}
          onClose={() => setIntakeDetailId(null)}
          onUpdated={(nextWorkspace) => setWorkspace(nextWorkspace)}
          onOpenSupplier={(supplierId) => {
            setIntakeDetailId(null);
            setDetail({ type: 'supplier', id: supplierId });
          }}
          onOpenRule={(ruleKey) => {
            setIntakeDetailId(null);
            openRuleReference(ruleKey);
          }}
        />
      ) : null}
      {detail && workspace ? (
        <RecordDetailDialog
          workspace={workspace}
          selection={detail}
          onClose={() => setDetail(null)}
          onRefresh={loadWorkspace}
        />
      ) : null}
    </main>
  );
}
