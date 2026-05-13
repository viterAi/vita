"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { AiPage, AiPageStatus, View, Draft } from "../types";

type VersionRow = { version_number: number; summary: string; created_at: string };

type Props = {
  aiPages: AiPage[];
  activeAiPageId: string;
  setActiveAiPageId: (id: string) => void;
  aiPageStatuses: AiPageStatus[];
  views: View[];
  activeViewId: string;
  savedViewId: string | null;
  switchToView: (id: string) => void;
  addViewForSource: () => void;
  duplicateActiveView: () => void;
  deleteViewById: (id: string) => void;
  renameViewById: (id: string, name: string) => void;
  setDefaultViewById: (id: string) => void;
  reorderViewById: (id: string, dir: "left" | "right") => void;
  restoreViewVersion: (versionNumber: number) => void;
  secondaryComposedViewId: string | null;
  toggleComposedSplit: () => void;
  setComposedSecondary: (id: string | null) => void;
  pendingDraft: Draft | null;
  activeView: View | null;
  applyDraft: () => void;
  busy: string;
  sourceName: string;
  generating: boolean;
  isSaved: boolean;
  isSavingLayout: boolean;
  isRefreshingContent: boolean;
  saveError: string;
  hasDynamic: boolean;
  onSaveLayout: () => void;
  onRegenerate: () => void;
  onRefreshData: () => void;
};

const detailBtn: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 4,
  color: "var(--ink-secondary)",
  boxShadow: "inset 0 0 0 1px var(--line-thin)",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
};

export function TabBar({
  aiPages, activeAiPageId, setActiveAiPageId, aiPageStatuses,
  views, activeViewId, savedViewId,
  switchToView, addViewForSource, duplicateActiveView,
  deleteViewById, renameViewById, setDefaultViewById, reorderViewById,
  restoreViewVersion,
  secondaryComposedViewId, toggleComposedSplit, setComposedSecondary,
  pendingDraft, activeView, applyDraft, busy, sourceName,
  generating, isSaved, isSavingLayout, isRefreshingContent, saveError, hasDynamic,
  onSaveLayout, onRegenerate, onRefreshData,
}: Props) {
  const pagesReady = !generating && aiPages.length > 0;
  const sortedViews = useMemo(
    () => [...views].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [views],
  );
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionRows, setVersionRows] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const layoutMenuRef = useRef<HTMLDetailsElement>(null);
  const canvasMenuRef = useRef<HTMLDetailsElement>(null);

  const closeMenus = () => {
    if (layoutMenuRef.current) layoutMenuRef.current.open = false;
    if (canvasMenuRef.current) canvasMenuRef.current.open = false;
  };

  const loadVersions = useCallback(async () => {
    if (!savedViewId) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/views/${savedViewId}/versions`);
      const body = (await res.json()) as { versions?: VersionRow[] };
      setVersionRows(body.versions ?? []);
    } finally {
      setVersionsLoading(false);
    }
  }, [savedViewId]);

  const openHistory = () => {
    closeMenus();
    setVersionsOpen(true);
    void loadVersions();
  };

  const compareOn = secondaryComposedViewId !== null;
  const activeLayout = sortedViews.find((v) => v.id === activeViewId);

  return (
    <div style={{ borderBottom: "0.5px solid var(--line-thin)" }}>
      {/* Row 1 — source + canvas-wide actions */}
      <div
        style={{
          padding: "3px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          borderBottom: sortedViews.length > 0 || aiPages.length > 0 ? "0.5px solid var(--line-thin)" : undefined,
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 100px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: "var(--ink-tertiary)", letterSpacing: "0.06em" }}>SRC</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", lineHeight: 1.15 }}>{sourceName || "—"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isRefreshingContent && !generating && (
            <span style={{ fontSize: 9, color: "var(--ink-tertiary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 1.4s ease-in-out infinite", display: "inline-block" }} />
              …
            </span>
          )}
          {pagesReady && isSaved && !isRefreshingContent && (
            <span style={{ fontSize: 9, color: "var(--good)", display: "inline-flex", alignItems: "center", gap: 2 }}>
              <span aria-hidden>✓</span>
            </span>
          )}

          <details ref={canvasMenuRef} className="details-tabmenu" style={{ position: "relative" }} title="Canvas actions">
            <summary style={{ ...detailBtn, listStyle: "none", fontWeight: 500 }}>⋯</summary>
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 2,
                minWidth: 176,
                padding: 3,
                borderRadius: 5,
                background: "var(--bg-surface)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.12), inset 0 0 0 0.5px var(--line-thin)",
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {pagesReady && !isSaved && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={isSavingLayout}
                  onClick={() => {
                    closeMenus();
                    onSaveLayout();
                  }}
                  style={{
                    textAlign: "left",
                    border: "none",
                    background: saveError ? "var(--warn-tint)" : "transparent",
                    cursor: isSavingLayout ? "wait" : "pointer",
                    padding: "5px 7px",
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  {isSavingLayout ? "Saving…" : saveError ? "Retry save layout" : "Save layout"}
                </button>
              )}
              {pagesReady && isSaved && hasDynamic && !isRefreshingContent && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!!busy}
                  onClick={() => {
                    closeMenus();
                    onRefreshData();
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                >
                  Refresh dynamic blocks
                </button>
              )}
              {pagesReady && isSaved && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!!busy}
                  onClick={() => {
                    closeMenus();
                    onRegenerate();
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                >
                  Regenerate from scratch
                </button>
              )}
              {savedViewId && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenus();
                    openHistory();
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                >
                  Version history…
                </button>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Row 2 — saved layouts (switch saved specs for this source) */}
      {sortedViews.length > 0 && (
        <div
          style={{
            padding: "3px 12px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            rowGap: 4,
            borderBottom: aiPages.length > 0 ? "0.5px solid var(--line-thin)" : undefined,
            background: compareOn ? "var(--accent-tint)" : "var(--bg-secondary)",
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 700, color: "var(--ink-tertiary)", letterSpacing: "0.07em", flexShrink: 0 }}>
            LYT
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
            {sortedViews.map((v) => {
              const isActive = v.id === activeViewId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => switchToView(v.id)}
                  title={v.is_default ? "Default for this source" : undefined}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 500,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: isActive ? "var(--accent)" : "var(--bg-surface)",
                    color: isActive ? "#fff" : "var(--ink-secondary)",
                    boxShadow: isActive ? "none" : "inset 0 0 0 1px var(--line-thin)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.view_name}
                  {v.is_default ? " *" : ""}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void addViewForSource()}
              disabled={!!busy || generating}
              title="New layout"
              style={{
                border: "none",
                cursor: busy || generating ? "wait" : "pointer",
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 999,
                background: "transparent",
                color: "var(--accent)",
                boxShadow: "inset 0 0 0 1px var(--accent)",
                opacity: busy || generating ? 0.5 : 1,
              }}
            >
              +
            </button>
          </div>

          {savedViewId && activeLayout && (
            <details ref={layoutMenuRef} className="details-tabmenu" style={{ position: "relative" }} title="Layout options">
              <summary style={{ ...detailBtn, fontWeight: 500 }}>⚙</summary>
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 2,
                  minWidth: 188,
                  padding: 3,
                  borderRadius: 5,
                  background: "var(--bg-surface)",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.12), inset 0 0 0 0.5px var(--line-thin)",
                  zIndex: 40,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    const name = typeof window !== "undefined" ? window.prompt("Layout name", activeLayout.view_name) : null;
                    if (name?.trim()) void renameViewById(activeLayout.id, name.trim());
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                >
                  Rename…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    void duplicateActiveView();
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                >
                  Duplicate layout
                </button>
                {!activeLayout.is_default && (
                  <button
                    type="button"
                    onClick={() => {
                      closeMenus();
                      void setDefaultViewById(activeLayout.id);
                    }}
                    style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                  >
                    Set as default for this source
                  </button>
                )}
                {sortedViews.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus();
                        reorderViewById(activeLayout.id, "left");
                      }}
                      style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                    >
                      Move left in list
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus();
                        reorderViewById(activeLayout.id, "right");
                      }}
                      style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11 }}
                    >
                      Move right in list
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    if (typeof window !== "undefined" && window.confirm(`Delete layout “${activeLayout.view_name}”? This cannot be undone.`)) void deleteViewById(activeLayout.id);
                  }}
                  style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "5px 7px", borderRadius: 4, fontSize: 11, color: "var(--warn)" }}
                >
                  Delete layout…
                </button>
              </div>
            </details>
          )}

          {sortedViews.length >= 2 && savedViewId ? (
            <>
              <span aria-hidden style={{ width: 1, height: 14, background: "var(--line-strong)", flexShrink: 0, opacity: 0.65 }} />
              <div
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}
                title="Side-by-side reference (read-only). Resize with the divider."
              >
                <label style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 10, fontWeight: 500, userSelect: "none", color: "var(--ink-secondary)" }}>
                  <input type="checkbox" checked={compareOn} onChange={() => toggleComposedSplit()} />
                  2-up
                </label>
                {compareOn && (
                  <select
                    value={secondaryComposedViewId ?? ""}
                    onChange={(e) => setComposedSecondary(e.target.value || null)}
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--line-strong)",
                      background: "var(--bg-surface)",
                      minWidth: 96,
                      maxWidth: 160,
                    }}
                  >
                    <option value="">Ref…</option>
                    {sortedViews.filter((v) => v.id !== savedViewId).map((v) => (
                      <option key={v.id} value={v.id}>{v.view_name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Pages — inline compact strip */}
      {aiPages.length > 0 && (
        <div style={{ padding: "2px 12px 3px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: "var(--ink-tertiary)", letterSpacing: "0.07em", flexShrink: 0 }}>
            PG
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-secondary)", flexShrink: 0 }}>{aiPages.length}</span>
          <div style={{ display: "flex", overflowX: "auto", gap: 2, flex: 1, minWidth: 0, scrollbarWidth: "thin" }}>
            {aiPages.map((page, i) => {
              const isActive = page.id === activeAiPageId;
              const pageStatus = aiPageStatuses.find((s) => s.page_id === page.id);
              const isFailed = pageStatus?.state === "invalid";
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setActiveAiPageId(page.id)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                    borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1,
                    background: "transparent",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      background: isActive ? "var(--accent)" : "var(--bg-secondary)",
                      color: isActive ? "#fff" : "var(--ink-tertiary)",
                      fontSize: 8,
                      fontWeight: 700,
                      boxShadow: isActive ? "none" : "inset 0 0 0 1px var(--line-thin)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {page.title}
                  {isFailed && <span style={{ fontSize: 8, color: "var(--warn)" }}>!</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {versionsOpen && (
        <div style={{ padding: "8px 14px", background: "var(--bg-secondary)", borderTop: "0.5px solid var(--line-thin)", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Version history</span>
            <button type="button" style={{ all: "unset", cursor: "pointer", color: "var(--accent)", fontWeight: 500 }} onClick={() => setVersionsOpen(false)}>
              Close
            </button>
          </div>
          {versionsLoading ? <div style={{ color: "var(--ink-tertiary)" }}>Loading…</div> : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {versionRows.map((row) => (
                <li key={row.version_number} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    <strong>v{row.version_number}</strong> — {row.summary}
                    <span style={{ fontSize: 11, color: "var(--ink-tertiary)", display: "block", marginTop: 2 }}>
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    style={{ all: "unset", cursor: "pointer", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}
                    onClick={() => void restoreViewVersion(row.version_number)}
                  >
                    Restore
                  </button>
                </li>
              ))}
              {versionRows.length === 0 && <li style={{ color: "var(--ink-tertiary)" }}>No versions yet.</li>}
            </ul>
          )}
        </div>
      )}

      {pendingDraft && (activeView ?? savedViewId) ? (
        <div style={{ margin: "6px 14px 8px", padding: "7px 10px", borderRadius: 6, background: "var(--warn-tint)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.35 }}>
            Draft layout ready — apply when you want to replace the current spec.
          </div>
          <button
            type="button"
            onClick={applyDraft}
            style={{ border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 5, background: "var(--ink-primary)", color: "white" }}
          >
            Apply
          </button>
        </div>
      ) : null}
    </div>
  );
}
