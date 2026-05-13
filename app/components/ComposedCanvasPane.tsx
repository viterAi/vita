"use client";

import React, { useEffect, useState } from "react";
import type { AiPage, Row, UiColumn } from "../types";
import { AiComponentRenderer } from "./AiComponentRenderer";

type Props = {
  sourceId: string;
  /** Secondary saved view id — dock / steer still control the primary pane only. */
  viewId: string | null;
  rows: Row[];
  busy: boolean;
};

/**
 * Read-only side pane for composed mode: loads `spec.ai_pages` from GET `/api/views/:id`.
 */
export function ComposedCanvasPane({ sourceId, viewId, rows, busy }: Props) {
  const [pages, setPages] = useState<AiPage[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");

  const activeColumns: UiColumn[] = Object.keys(rows[0] ?? {}).map((field) => ({
    id: field,
    field,
    label: field,
    kind: "string" as const,
  }));
  const attentionRows = rows.slice(0, 5);

  useEffect(() => {
    if (!viewId || !sourceId) {
      setPages([]);
      setTitle("");
      setErr("");
      return;
    }
    let cancelled = false;
    setErr("");
    void (async () => {
      const res = await fetch(`/api/views/${viewId}`);
      const body = (await res.json().catch(() => ({}))) as { view?: { view_name?: string; spec?: { ai_pages?: AiPage[] } }; error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setErr(body.error ?? "Could not load view.");
        setPages([]);
        setTitle("");
        return;
      }
      const v = body.view;
      setTitle(v?.view_name ?? "");
      setPages(Array.isArray(v?.spec?.ai_pages) ? v.spec.ai_pages : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewId, sourceId]);

  if (!viewId) return null;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderLeft: "0.5px solid var(--line-thin)",
        overflowY: "auto",
        padding: 16,
        background: "var(--bg-secondary)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-tertiary)", marginBottom: 10, letterSpacing: "0.04em" }}>
        SPLIT VIEW — {title || "…"}
      </div>
      {err ? (
        <div style={{ fontSize: 12, color: "var(--warn)" }}>{err}</div>
      ) : pages.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>{busy ? "Loading…" : "No pages in this saved view."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {pages.map((page) => (
            <div key={page.id}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{page.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {page.components.map((c, i) => (
                  <AiComponentRenderer
                    key={`${page.id}-${c.component_id}-${i}`}
                    component={c}
                    index={i}
                    rows={rows}
                    activeColumns={activeColumns}
                    attentionRows={attentionRows}
                    isRefreshing={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
