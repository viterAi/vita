"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useResizablePanels() {
  const [leftWidth, setLeftWidth] = useState<number>(200);
  const draggingLeft = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem("viter-left-width");
    if (stored) setLeftWidth(Number(stored));
  }, []);
  useEffect(() => {
    localStorage.setItem("viter-left-width", String(leftWidth));
  }, [leftWidth]);

  const startDragLeft = useCallback((e: React.MouseEvent) => {
    draggingLeft.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!draggingLeft.current) return;
      setLeftWidth(Math.max(140, Math.min(360, dragStartWidth.current + ev.clientX - dragStartX.current)));
    };
    const onUp = () => {
      draggingLeft.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  return { leftWidth, startDragLeft };
}
