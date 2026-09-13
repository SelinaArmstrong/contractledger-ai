'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Workspace } from '@/lib/contract-ledger-types';
import { CONTRACT_PLAYBOOK, PLAYBOOK_VERSION } from '@/lib/contract-playbook';
import type { PlaybookCategory } from '@/lib/contract-playbook';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { titleCase, valueText } from '@/components/workspace/formatters';
import {
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';

const categoryLabels: Record<PlaybookCategory, string> = {
  commercial: 'Commercial',
  legal: 'Legal',
  risk: 'Risk & insurance',
  operational: 'Operational',
};

const triggerDescriptions: Record<string, (config: TriggerConfig) => string> = {
  value_above: (config) => {
    const floor = money(config.thresholdCents);
    const ceiling = Number(config.maxCents ?? 0);
    return ceiling > 0
      ? `Verified contract value is above ${floor} and up to ${money(config.maxCents)}.`
      : `Verified contract value is above ${floor}.`;
  },
  governing_law_not_allowed: (config) =>
    `Verified governing law is not ${titleCase(configText(config.allowedText, 'california'))}.`,
  automatic_renewal: () => 'Verified renewal type is automatic.',
  insurance_status_in: (config) =>
    `Supplier insurance status is ${listText(config.statuses)}.`,
  supplier_risk_tier_in: (config) =>
    `Supplier risk tier is ${listText(config.riskTiers)}.`,
};

type TriggerConfig = Record<string, unknown>;

function money(cents: unknown) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(cents ?? 0) / 100);
}

function configText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function listText(value: unknown) {
  return Array.isArray(value) && value.length
    ? value.map((item) => String(item)).join(' or ')
    : 'a configured value';
}

function parseConfig(value: unknown): TriggerConfig {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as TriggerConfig)
      : {};
  } catch {
    return {};
  }
}

type RulesTab = 'review' | 'approval';

/**
 * Read-only reference for the two rule sets the workspace runs on. Both are
 * rendered from the definitions the engines actually evaluate, so the page
 * cannot drift from behaviour. Changing a rule is a code and migration change
 * on purpose: a control that any reviewer could edit in place is not a control.
 */
export function PlaybookRulesView({
  workspace,
  focusRuleKey,
  onFocusHandled,
}: {
  workspace: Workspace | null;
  /** Rule to scroll to and highlight, set when arriving from a deep link. */
  focusRuleKey: string | null;
  onFocusHandled: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<RulesTab>('review');
  const focusRef = useRef<HTMLTableRowElement>(null);
  const approvalRules = workspace?.approvalRules ?? [];
  const escalating = CONTRACT_PLAYBOOK.filter(
    (rule) => rule.approvalRuleKey,
  ).length;

  // A deep link decides which tab is shown, so the highlighted rule is never
  // hidden behind the other one. Choosing a tab by hand clears the highlight.
  const tab: RulesTab = focusRuleKey
    ? CONTRACT_PLAYBOOK.some((rule) => rule.key === focusRuleKey)
      ? 'review'
      : 'approval'
    : selectedTab;

  useEffect(() => {
    if (!focusRuleKey || !focusRef.current) return;
    focusRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRuleKey]);

  return (
    <>
      <PageHeading
        eyebrow="Reference"
        title="Playbook & Approval Rules"
        description="The company standards New Contract Review checks drafts against, and the versioned controls that turn a material deviation into a required decision. This page is read-only."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          [
            'Review standards',
            String(CONTRACT_PLAYBOOK.length),
            `Playbook version ${PLAYBOOK_VERSION}`,
          ],
          [
            'Approval controls',
            String(approvalRules.length),
            'Active versioned rules',
          ],
          [
            'Standards that escalate',
            String(escalating),
            'Remaining findings are advisory',
          ],
        ].map(([label, value, note]) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(15_23_42/3%)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <fieldset
        className="mb-5 inline-flex rounded-md border border-border bg-muted p-0.5"
        aria-label="Rule set"
      >
        {(
          [
            ['review', 'Contract review rules', BookOpenCheck],
            ['approval', 'Approval controls', ShieldCheck],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSelectedTab(value);
              onFocusHandled();
            }}
            aria-pressed={tab === value}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === value
                ? 'bg-card text-accent-foreground shadow-[0_1px_2px_rgb(15_23_42/8%)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </fieldset>

      {tab === 'review' ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Contract review rules"
            description="Evaluated by the model against the draft text at upload. A deviation becomes a finding; only the rules marked below also create a required decision."
          />
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="w-14 px-4 text-center">No.</TableHead>
                <TableHead className="min-w-52">Rule</TableHead>
                <TableHead>Company standard</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-44 pr-5">On deviation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONTRACT_PLAYBOOK.map((rule, index) => (
                <TableRow
                  key={rule.key}
                  ref={rule.key === focusRuleKey ? focusRef : undefined}
                  className={
                    rule.key === focusRuleKey ? 'bg-accent' : undefined
                  }
                >
                  <TableCell className="px-4 text-center text-xs font-medium text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="text-xs font-medium text-foreground">
                      {rule.title}
                    </div>
                    <code className="mt-1 block text-[11px] text-slate-500">
                      {rule.key}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-96 whitespace-normal text-[11px] leading-4 text-slate-600">
                    {rule.standard}
                  </TableCell>
                  <TableCell className="text-[11px]">
                    {categoryLabels[rule.category]}
                  </TableCell>
                  <TableCell className="pr-5">
                    {rule.approvalRuleKey ? (
                      <StatusBadge tone="amber">Creates approval</StatusBadge>
                    ) : (
                      <StatusBadge tone="slate">Advisory finding</StatusBadge>
                    )}
                    {rule.approvalRuleKey ? (
                      <code className="mt-1 block text-[11px] text-slate-500">
                        {rule.approvalRuleKey}
                      </code>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Approval controls"
            description="Evaluated deterministically against human-verified values when a reviewed draft is saved. A mandatory control blocks approval for signature and executed registration until it is decided."
          />
          {approvalRules.length ? (
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-14 px-4 text-center">No.</TableHead>
                  <TableHead className="min-w-52">Control</TableHead>
                  <TableHead>Trigger condition</TableHead>
                  <TableHead className="w-44">Decision owner</TableHead>
                  <TableHead className="w-24">Deadline</TableHead>
                  <TableHead className="w-40 pr-5">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalRules.map((rule, index) => {
                  const ruleKey = valueText(rule.rule_key);
                  const config = parseConfig(rule.trigger_config_json);
                  const describe =
                    triggerDescriptions[valueText(rule.trigger_type)];
                  const playbookSource = CONTRACT_PLAYBOOK.find(
                    (item) => item.approvalRuleKey === ruleKey,
                  );
                  return (
                    <TableRow
                      key={String(rule.id)}
                      ref={ruleKey === focusRuleKey ? focusRef : undefined}
                      className={
                        ruleKey === focusRuleKey ? 'bg-accent' : undefined
                      }
                    >
                      <TableCell className="px-4 text-center text-xs font-medium text-slate-500">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="text-xs font-medium text-foreground">
                          {valueText(rule.name)}
                        </div>
                        <code className="mt-1 block text-[11px] text-slate-500">
                          {ruleKey} · v{valueText(rule.version)}
                        </code>
                        <div className="mt-1.5">
                          <StatusBadge
                            tone={Number(rule.mandatory) ? 'rose' : 'blue'}
                          >
                            {Number(rule.mandatory)
                              ? 'Mandatory gate'
                              : 'Advisory'}
                          </StatusBadge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-96 whitespace-normal text-[11px] leading-4 text-slate-600">
                        {describe
                          ? describe(config)
                          : valueText(rule.description)}
                        <div className="mt-1 text-[11px] text-slate-400">
                          {valueText(rule.trigger_type)}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] font-medium text-slate-700">
                        {valueText(rule.owner_role)}
                      </TableCell>
                      <TableCell className="text-[11px]">
                        {valueText(rule.due_days)} days
                      </TableCell>
                      <TableCell className="pr-5 text-[11px]">
                        {playbookSource ? (
                          <>
                            <div className="text-slate-700">
                              {playbookSource.title}
                            </div>
                            <code className="mt-1 block text-[11px] text-slate-500">
                              {playbookSource.key}
                            </code>
                          </>
                        ) : (
                          <span className="text-slate-500">
                            Register fact, not a clause deviation
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Approval controls are loading"
              description="Active rule definitions are read from the workspace."
            />
          )}
        </Panel>
      )}

      <p className="mt-5 text-[11px] leading-5 text-slate-500">
        Rules are versioned and are not editable from the workspace. Each
        approval request stores a snapshot of the rule that created it, so a
        past decision can still be read against the standard that was in force
        at the time.
        {focusRuleKey ? (
          <button
            type="button"
            onClick={onFocusHandled}
            className="ml-2 font-medium text-accent-foreground hover:underline"
          >
            Clear highlight
          </button>
        ) : null}
      </p>
    </>
  );
}
