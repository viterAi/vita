"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AiPage, Row, UiColumn } from "../types";
import { AiComponentRenderer } from "./AiComponentRenderer";

const PREVIEW_ALL = "__preview_all__";

type Props = {
  sourceId: string;
  /** Secondary saved view id — dock / steer still control the primary pane only. */
  viewId: string | null;
  rows: Row[];
};

function PageBody({
  page,
  rows,
  activeColumns,
  attentionRows,
}: {
  page: AiPage;
  rows: Row[];
  activeColumns: UiColumn[];
  attentionRows: Row[];
}) {
  return (
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
  );
}

/**
 * Read-only side pane for compare mode: loads `spec.ai_pages` from GET `/api/views/:id`.
 * Browse **All pages** (scroll) or pick one page via tabs.
 */
export function ComposedCanvasPane({ sourceId, viewId, rows }: Props) {
  const [pages, setPages] = useState<AiPage[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<string>(PREVIEW_ALL);

  const activeColumns: UiColumn[] = useMemo(
    () =>
      Object.keys(rows[0] ?? {}).map((field) => ({
        id: field,
        field,
        label: field,
        kind: "string" as const,
      })),
    [rows],
  );
  const attentionRows = rows.slice(0, 5);

  useEffect(() => {
    if (!viewId || !sourceId) {
      setPages([]);
      setTitle("");
      setErr("");
      setLoading(false);
      setPreviewTab(PREVIEW_ALL);
      return;
    }
    let cancelled = false;
    setErr("");
    setLoading(true);
    void (async () => {
      const res = await fetch(`/api/views/${viewId}`);
      const body = (await res.json().catch(() => ({}))) as { view?: { view_name?: string; spec?: { ai_pages?: AiPage[] } }; error?: string };
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setErr(body.error ?? "Could not load layout.");
        setPages([]);
        setTitle("");
        return;
      }
      const v = body.view;
      setTitle(v?.view_name ?? "");
      const next = Array.isArray(v?.spec?.ai_pages) ? v.spec.ai_pages : [];
      setPages(next);
      setPreviewTab(PREVIEW_ALL);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewId, sourceId]);

  const activePage = pages.find((p) => p.id === previewTab);

  if (!viewId) return null;

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderLeft: "3px solid var(--accent)",
        background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-surface) 18%)",
        boxShadow: "inset 1px 0 0 var(--line-thin)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "8px 12px",
          borderBottom: "0.5px solid var(--line-thin)",
          background: "var(--bg-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.07em",
              color: "var(--accent)",
              background: "var(--accent-tint)",
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            REF
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>{title || "…"}</span>
          {pages.length > 0 && (
            <span style={{ fontSize: 10, color: "var(--ink-tertiary)", marginLeft: "auto" }}>
              {pages.length} page{pages.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {!loading && !err && pages.length > 1 && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            overflowX: "auto",
            gap: 2,
            padding: "6px 10px",
            borderBottom: "0.5px solid var(--line-thin)",
            background: "var(--bg-secondary)",
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewTab(PREVIEW_ALL)}
            title="Scroll through every page in this layout"
            style={{
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              padding: "5px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: previewTab === PREVIEW_ALL ? 600 : 500,
              background: previewTab === PREVIEW_ALL ? "var(--accent)" : "var(--bg-surface)",
              color: previewTab === PREVIEW_ALL ? "#fff" : "var(--ink-secondary)",
              boxShadow: previewTab === PREVIEW_ALL ? "none" : "inset 0 0 0 1px var(--line-thin)",
            }}
          >
            All pages
          </button>
          {pages.map((p, i) => {
            const isActive = previewTab === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreviewTab(p.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "var(--accent)" : "var(--bg-surface)",
                  color: isActive ? "#fff" : "var(--ink-secondary)",
                  boxShadow: isActive ? "none" : "inset 0 0 0 1px var(--line-thin)",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={p.title}
              >
                {i + 1}. {p.title}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Loading…</div>
        ) : err ? (
          <div style={{ fontSize: 12, color: "var(--warn)" }}>{err}</div>
        ) : pages.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>No pages in this layout.</div>
        ) : previewTab === PREVIEW_ALL ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {pages.map((page, idx) => (
              <section key={page.id} style={{ scrollMarginTop: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink-tertiary)",
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "0.5px solid var(--line-thin)",
                  }}
                >
                  Page {idx + 1} · {page.title}
                </div>
                <PageBody page={page} rows={rows} activeColumns={activeColumns} attentionRows={attentionRows} />
              </section>
            ))}
          </div>
        ) : activePage ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 10 }}>{activePage.title}</div>
            <PageBody page={activePage} rows={rows} activeColumns={activeColumns} attentionRows={attentionRows} />
          </div>
        ) : (
          <PageBody page={pages[0]!} rows={rows} activeColumns={activeColumns} attentionRows={attentionRows} />
        )}
      </div>
    </div>
  );
}
