'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  LoaderCircle,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { titleCase, usDateText } from '@/components/workspace/formatters';

export function RegisterUtilities({
  hasPrimaryAction,
  exportLabel,
  onExport,
  exportDisabled,
  exporting,
  onInsights,
  insightsDisabled,
}: {
  hasPrimaryAction: boolean;
  exportLabel: string;
  onExport?: () => void;
  exportDisabled: boolean;
  exporting: boolean;
  onInsights?: () => void;
  insightsDisabled: boolean;
}) {
  if (!onExport && !onInsights) return null;

  const ExportIcon = exporting ? LoaderCircle : FileSpreadsheet;
  const compact = hasPrimaryAction || Boolean(onExport && onInsights);

  return (
    <>
      <div
        className={compact ? 'hidden flex-wrap gap-2 sm:flex' : 'flex gap-2'}
      >
        {onExport ? (
          <Button
            variant="outline"
            onClick={onExport}
            disabled={exportDisabled}
            className="h-11 bg-card"
          >
            <ExportIcon className={exporting ? 'animate-spin' : undefined} />
            {exportLabel}
          </Button>
        ) : null}
        {onInsights ? (
          <Button
            variant="outline"
            onClick={onInsights}
            disabled={insightsDisabled}
            className="h-11 bg-card text-accent-foreground"
          >
            <Sparkles /> AI management insights
          </Button>
        ) : null}
      </div>
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More register actions"
            render={
              <Button
                variant="outline"
                size="icon"
                className="size-11 bg-card sm:hidden"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onExport ? (
              <DropdownMenuItem
                onClick={onExport}
                disabled={exportDisabled}
                className="min-h-11"
              >
                <ExportIcon
                  className={exporting ? 'animate-spin' : undefined}
                />
                {exportLabel}
              </DropdownMenuItem>
            ) : null}
            {onInsights ? (
              <DropdownMenuItem
                onClick={onInsights}
                disabled={insightsDisabled}
                className="min-h-11"
              >
                <Sparkles /> AI management insights
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}

export function RegisterToolbar({
  label,
  placeholder,
  search,
  onSearch,
  matchCount,
  totalCount,
  filterCount,
  loading,
  unavailable,
  children,
}: {
  label: string;
  placeholder: string;
  search: string;
  onSearch: (value: string) => void;
  matchCount: number;
  totalCount: number;
  filterCount: number;
  loading: boolean;
  unavailable?: boolean;
  children: ReactNode;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersId = useId();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-3 py-3 sm:px-5">
        <div className="relative min-w-0 flex-1 sm:max-w-96">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label={label}
            placeholder={placeholder}
            className="h-11 bg-card pl-9 pr-11 text-base sm:text-sm"
          />
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Clear ${label.toLowerCase()}`}
              className="absolute inset-y-0 right-0 size-11 text-muted-foreground"
              onClick={() => {
                onSearch('');
                searchRef.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant={filtersOpen || filterCount > 0 ? 'secondary' : 'outline'}
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="h-11"
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {filterCount > 0 ? (
            <span className="rounded bg-card px-1.5 text-xs">
              {filterCount}
            </span>
          ) : null}
        </Button>
        <output
          aria-live="polite"
          className="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto"
        >
          {unavailable
            ? 'Record count unavailable'
            : loading
              ? 'Loading records…'
              : matchCount === totalCount
                ? `${totalCount} record${totalCount === 1 ? '' : 's'}`
                : `${matchCount} of ${totalCount} records`}
        </output>
      </div>
      <div id={filtersId} hidden={!filtersOpen}>
        {children}
      </div>
    </>
  );
}

export function RegisterRecord({
  title,
  subtitle,
  children,
  onOpen,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-accent-foreground">
            {title}
          </span>
          <span className="mt-0.5 block break-words text-xs text-muted-foreground">
            {subtitle}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            {children}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>
    </li>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  titleCaseOptions = false,
  allLabel = 'All',
  includeAll = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
  titleCaseOptions?: boolean;
  allLabel?: string;
  includeAll?: boolean;
}) {
  return (
    <label className="text-[11px] font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-xs"
      >
        {includeAll ? <option value="all">{allLabel}</option> : null}
        {options.map((option) => {
          const optionValue =
            typeof option === 'string' ? option : option.value;
          const optionLabel =
            typeof option === 'string' ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {titleCaseOptions ? titleCase(optionLabel) : optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function USDateInput({
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const parseUSDate = (input: string) => {
    const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    )
      return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const selectedDate = (() => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return undefined;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  })();

  return (
    <div className="flex min-w-0 flex-1">
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM/DD/YYYY"
        value={displayValue ?? (value ? usDateText(value) : '')}
        onChange={(event) => {
          const nextValue = event.target.value
            .replace(/[^0-9/]/g, '')
            .slice(0, 10);
          setDisplayValue(nextValue);
          if (!nextValue) onChange('');
          const parsed = parseUSDate(nextValue);
          if (parsed) onChange(parsed);
        }}
        onBlur={() => setDisplayValue(null)}
        aria-label={ariaLabel}
        className={`${className} rounded-r-none border-r-0`}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          type="button"
          aria-label={`Open ${ariaLabel} calendar`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-r-md border border-input bg-card text-slate-500 transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(nextDate) => {
              if (!nextDate) return;
              const nextValue = `${String(nextDate.getFullYear()).padStart(4, '0')}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
              setDisplayValue(null);
              onChange(nextValue);
              setCalendarOpen(false);
            }}
            captionLayout="dropdown"
            startMonth={new Date(1990, 0, 1)}
            endMonth={new Date(2100, 11, 31)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateFilter({
  label,
  condition,
  onConditionChange,
  date,
  onDateChange,
}: {
  label: string;
  condition: string;
  onConditionChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
}) {
  return (
    <div className="text-[11px] font-medium text-slate-600">
      <span>{label}</span>
      <div className="mt-1 flex">
        <select
          value={condition}
          onChange={(event) => onConditionChange(event.target.value)}
          className="h-9 rounded-l-md border border-r-0 border-input bg-card px-2 text-xs"
        >
          <option value="all">Any date</option>
          <option value="on_or_before">On or before</option>
          <option value="on_or_after">On or after</option>
        </select>
        <USDateInput
          key={date || 'empty-date'}
          value={date}
          onChange={onDateChange}
          ariaLabel={`${label} filter date in month/day/year format`}
          className="h-9 rounded-none bg-card text-xs"
        />
      </div>
    </div>
  );
}

export function useFloatingTableScrollbar() {
  const tableScrollerRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollerRef = useRef<HTMLDivElement>(null);
  /**
   * The table only mounts once the workspace has loaded, so a plain ref object
   * is still null when the measuring effect first runs — and the effect never
   * re-runs, which left the floating scrollbar permanently hidden. Tracking the
   * node in state re-runs the effect the moment it attaches.
   */
  const [scrollerNode, setScrollerNode] = useState<HTMLDivElement | null>(null);
  const attachTableScroller = useCallback((node: HTMLDivElement | null) => {
    tableScrollerRef.current = node;
    setScrollerNode(node);
  }, []);
  const [floating, setFloating] = useState({
    visible: false,
    left: 0,
    width: 0,
    contentWidth: 0,
  });

  const updateFloatingPosition = useCallback(() => {
    const scroller = tableScrollerRef.current;
    if (!scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min(window.innerWidth, bounds.right);
    const width = Math.max(0, right - left);
    const hasHorizontalOverflow =
      scroller.scrollWidth > scroller.clientWidth + 1;
    const intersectsViewport =
      bounds.top < window.innerHeight && bounds.bottom > 0;
    const nativeScrollbarBelowViewport = bounds.bottom > window.innerHeight - 2;
    setFloating({
      visible:
        hasHorizontalOverflow &&
        intersectsViewport &&
        nativeScrollbarBelowViewport &&
        width > 0,
      left,
      width,
      contentWidth: scroller.scrollWidth,
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerNode;
    if (!scroller) return;
    updateFloatingPosition();
    const observer = new ResizeObserver(updateFloatingPosition);
    observer.observe(scroller);
    if (scroller.firstElementChild)
      observer.observe(scroller.firstElementChild);
    window.addEventListener('resize', updateFloatingPosition);
    window.addEventListener('scroll', updateFloatingPosition, {
      passive: true,
    });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFloatingPosition);
      window.removeEventListener('scroll', updateFloatingPosition);
    };
  }, [scrollerNode, updateFloatingPosition]);

  useEffect(() => {
    if (floating.visible && floatingScrollerRef.current)
      floatingScrollerRef.current.scrollLeft =
        tableScrollerRef.current?.scrollLeft ?? 0;
  }, [floating.visible, floating.contentWidth]);

  const syncFloatingToTable = () => {
    if (tableScrollerRef.current && floatingScrollerRef.current)
      tableScrollerRef.current.scrollLeft =
        floatingScrollerRef.current.scrollLeft;
  };
  const syncTableToFloating = () => {
    if (tableScrollerRef.current && floatingScrollerRef.current)
      floatingScrollerRef.current.scrollLeft =
        tableScrollerRef.current.scrollLeft;
  };

  return {
    tableScrollerRef: attachTableScroller,
    floatingScrollerRef,
    floating,
    syncFloatingToTable,
    syncTableToFloating,
  };
}

export function FloatingTableScrollbar({
  label,
  floating,
  floatingScrollerRef,
  onScroll,
}: {
  label: string;
  floating: {
    visible: boolean;
    left: number;
    width: number;
    contentWidth: number;
  };
  floatingScrollerRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  if (!floating.visible) return null;
  return (
    <div
      ref={floatingScrollerRef}
      aria-label={label}
      onScroll={onScroll}
      className="fixed bottom-0 z-40 h-5 overflow-x-scroll overflow-y-hidden border-x border-t border-[#a9c7d2] bg-card/95 shadow-[0_-3px_10px_rgb(15_23_42/12%)] backdrop-blur"
      style={{ left: floating.left, width: floating.width }}
    >
      <div
        aria-hidden="true"
        className="h-px"
        style={{ width: floating.contentWidth }}
      />
    </div>
  );
}

export function TablePagination({
  label,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  floating,
}: {
  label: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  floating?: {
    visible: boolean;
    left: number;
    width: number;
  };
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRecord = total ? (page - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(page * pageSize, total);
  const floatingVisible = Boolean(floating?.visible);

  return (
    <nav
      aria-label={label}
      className={`${floatingVisible ? 'fixed bottom-5 z-40 shadow-[0_-3px_10px_rgb(15_23_42/10%)] backdrop-blur' : 'border-t border-border'} flex min-h-11 flex-wrap items-center justify-end gap-x-4 gap-y-2 bg-card/95 px-4 py-2 text-[11px] text-slate-600`}
      style={
        floatingVisible
          ? { left: floating?.left, width: floating?.width }
          : undefined
      }
    >
      <label className="flex items-center gap-2 whitespace-nowrap">
        Rows per page
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-7 rounded-md border border-input bg-card px-2 text-[11px]"
        >
          {[20, 50, 100].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <span className="whitespace-nowrap">
        {firstRecord}–{lastRecord} of {total}
      </span>
      <span className="whitespace-nowrap font-medium text-foreground">
        Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="bg-card"
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount || total === 0}
          className="bg-card"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
