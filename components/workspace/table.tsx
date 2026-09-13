'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { titleCase, usDateText } from '@/components/workspace/formatters';

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
  const [displayValue, setDisplayValue] = useState(
    value ? usDateText(value) : '',
  );
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
        value={displayValue}
        onChange={(event) => {
          const nextValue = event.target.value
            .replace(/[^0-9/]/g, '')
            .slice(0, 10);
          setDisplayValue(nextValue);
          if (!nextValue) onChange('');
          const parsed = parseUSDate(nextValue);
          if (parsed) onChange(parsed);
        }}
        onBlur={() => {
          if (!parseUSDate(displayValue))
            setDisplayValue(value ? usDateText(value) : '');
        }}
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
              setDisplayValue(usDateText(nextValue));
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
