"use client";

import type { AiStatus, AiPageStatus } from "../types";

interface AiStatusPanelProps {
  aiStatus: AiStatus;
  aiPageStatuses: AiPageStatus[];
  onRetry: () => void;
}

export function AiStatusPanel({ aiStatus, aiPageStatuses, onRetry }: AiStatusPanelProps) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--r-card)", padding: "20px 16px", border: "0.5px solid var(--line-thin)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>AI status</div>
      <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
        state: <b>{aiStatus.state}</b>
      </div>
      {aiStatus.last_error ? (
        <div style={{ fontSize: 11, color: "var(--ink-secondary)", fontFamily: "monospace", background: "var(--bg-surface)", padding: "6px 8px", borderRadius: 4 }}>
          {aiStatus.last_error}
        </div>
      ) : null}
      {aiPageStatuses.length > 0 ? (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--ink-tertiary)" }}>Per-page status</div>
          {aiPageStatuses.map((ps) => (
            <div key={ps.page_id} style={{ fontSize: 11, color: ps.state === "invalid" ? "var(--ink-secondary)" : "var(--ink-tertiary)" }}>
              <b>{ps.page_id}</b>: {ps.state} — {ps.attempts_used} attempts{ps.last_error ? ` — ${ps.last_error}` : ""}
            </div>
          ))}
        </div>
      ) : null}
      <button
        onClick={onRetry}
        className="btn-solid"
        style={{ all: "unset", cursor: "pointer", marginTop: 4, fontSize: 11, padding: "6px 10px", borderRadius: 4, background: "var(--ink-primary)", color: "white", display: "inline-block" }}
      >
        Retry AI
      </button>
    </div>
  );
}
