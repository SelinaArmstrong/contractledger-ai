'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, PointerEventHandler, RefObject } from 'react';

const VIEWPORT_INSET = 8;
const MIN_VISIBLE_WIDTH = 160;
const MIN_VISIBLE_HEADER_HEIGHT = 48;
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [data-no-dialog-drag]';

export function useDraggableDialog<T extends HTMLElement>({
  surfaceRef,
  centered = false,
}: {
  surfaceRef: RefObject<T | null>;
  centered?: boolean;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const onPointerDown: PointerEventHandler<T> = (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-dialog-drag-handle]')) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<T> = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    event.preventDefault();

    const bounds = surface.getBoundingClientRect();
    const baseLeft = bounds.left - offset.x;
    const baseTop = bounds.top - offset.y;
    const desiredX = drag.offsetX + event.clientX - drag.startX;
    const desiredY = drag.offsetY + event.clientY - drag.startY;
    const visibleWidth = Math.min(MIN_VISIBLE_WIDTH, bounds.width);
    const minX = VIEWPORT_INSET + visibleWidth - baseLeft - bounds.width;
    const maxX = window.innerWidth - VIEWPORT_INSET - visibleWidth - baseLeft;
    const minY = VIEWPORT_INSET - baseTop;
    const maxY =
      window.innerHeight -
      VIEWPORT_INSET -
      Math.min(MIN_VISIBLE_HEADER_HEIGHT, bounds.height) -
      baseTop;

    setOffset({
      x: minX <= maxX ? Math.min(maxX, Math.max(minX, desiredX)) : 0,
      y: minY <= maxY ? Math.min(maxY, Math.max(minY, desiredY)) : 0,
    });
  };

  const releasePointer: PointerEventHandler<T> = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const surfaceStyle: CSSProperties = {
    transform: centered
      ? `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
      : `translate3d(${offset.x}px, ${offset.y}px, 0)`,
  };

  return {
    surfaceStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp: releasePointer,
    onPointerCancel: releasePointer,
  };
}
