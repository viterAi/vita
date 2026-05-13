"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "gui-compare-ref-width";
const DEFAULT_WIDTH = 360;
export const COMPARE_MIN_REFERENCE = 240;
export const COMPARE_MIN_PRIMARY = 280;
const HANDLE = 8;

/**
 * Fixed width for the reference (right) pane when compare split is on.
 * Drag the handle left/right to resize; persisted in localStorage.
 */
export function useCompareSplitResize(splitActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [referenceWidth, setReferenceWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number(stored);
      if (!Number.isNaN(n)) setReferenceWidth(Math.max(COMPARE_MIN_REFERENCE, n));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(referenceWidth));
  }, [referenceWidth]);

  const startDragCompare = useCallback(
    (e: React.MouseEvent) => {
      if (!splitActive || !containerRef.current) return;
      e.preventDefault();
      dragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = referenceWidth;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const maxReference = Math.max(COMPARE_MIN_REFERENCE, rect.width - HANDLE - COMPARE_MIN_PRIMARY);
        const delta = ev.clientX - dragStartX.current;
        // Drag handle right → narrower reference
        const next = Math.min(maxReference, Math.max(COMPARE_MIN_REFERENCE, dragStartWidth.current - delta));
        setReferenceWidth(next);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [splitActive, referenceWidth],
  );

  return { containerRef, referenceWidth, startDragCompare };
}
