'use client';

import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const zoomSteps = [75, 100, 125, 150, 175, 200, 250, 300];

/**
 * Source-document reader used beside AI extraction results. The zoom control
 * drives the browser's built-in PDF viewer through the `#zoom=` fragment, so it
 * only applies to PDF sources; text sources fall back to the browser default.
 */
export function DocumentViewer({
  title,
  description,
  fileName,
  sourceUrl,
  isPdf,
  height,
  emptyState,
  actions,
}: {
  title: string;
  description?: string;
  fileName?: string;
  sourceUrl: string;
  isPdf: boolean;
  /** CSS height for the framed document, e.g. `70vh`. */
  height: string;
  emptyState: ReactNode;
  actions?: ReactNode;
}) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncFullscreen = () =>
      setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void shellRef.current?.requestFullscreen?.();
  }, []);

  const stepZoom = (direction: 1 | -1) =>
    setZoom((current) => {
      const index = zoomSteps.indexOf(current);
      const nextIndex = Math.min(
        zoomSteps.length - 1,
        Math.max(0, (index === -1 ? 1 : index) + direction),
      );
      return zoomSteps[nextIndex] ?? current;
    });

  return (
    <div
      ref={shellRef}
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <h3 className="app-card-title truncate">{title}</h3>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {fileName ? `${fileName} · ` : ''}
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {sourceUrl && isPdf ? (
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom out"
                onClick={() => stepZoom(-1)}
                disabled={zoom === zoomSteps[0]}
                className="size-7 p-0"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <span className="w-11 text-center text-[11px] font-medium tabular-nums text-slate-600">
                {zoom}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom in"
                onClick={() => stepZoom(1)}
                disabled={zoom === zoomSteps[zoomSteps.length - 1]}
                className="size-7 p-0"
              >
                <ZoomIn className="size-3.5" />
              </Button>
            </div>
          ) : null}
          {sourceUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 bg-card text-xs"
              >
                {fullscreen ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
                {fullscreen ? 'Exit full screen' : 'Full screen'}
              </Button>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-accent-foreground hover:bg-slate-50"
              >
                <ExternalLink className="size-3.5" /> New tab
              </a>
            </>
          ) : null}
        </div>
      </div>
      {sourceUrl ? (
        <iframe
          key={`${sourceUrl}-${zoom}`}
          title={fileName ?? title}
          src={isPdf ? `${sourceUrl}#zoom=${zoom}` : sourceUrl}
          className={`w-full bg-card ${fullscreen ? 'min-h-0 flex-1' : ''}`}
          style={fullscreen ? undefined : { height }}
        />
      ) : (
        <div
          className={`flex flex-col items-center justify-center px-6 text-center ${fullscreen ? 'min-h-0 flex-1' : ''}`}
          style={fullscreen ? undefined : { minHeight: '320px', height }}
        >
          <FileText className="size-8 text-slate-300" />
          {emptyState}
        </div>
      )}
    </div>
  );
}
