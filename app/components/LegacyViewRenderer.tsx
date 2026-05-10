"use client";

import type { View, Row, UiColumn } from "../types";
import { eur } from "../utils";

const lanes = ["todo", "in_progress", "followed_up"] as const;

interface LegacyViewRendererProps {
  view: View;
  rows: Row[];
  activeColumns: UiColumn[];
  rowKey: string;
  busy: string;
  onMarkFollowedUp: (invoiceId: string) => void;
}

export function LegacyViewRenderer({ view, rows, activeColumns, rowKey, busy, onMarkFollowedUp }: LegacyViewRendererProps) {
  const todoCount = rows.filter((r) => r.follow_up_status === "todo").length;
  const inProgressCount = rows.filter((r) => r.follow_up_status === "in_progress").length;
  const followedUpCount = rows.filter((r) => r.follow_up_status === "followed_up").length;

  const numericColumns = activeColumns.filter((c) => c.kind === "number" && rows.some((r) => typeof r[c.field] === "number"));
  const primaryNumeric = numericColumns[0];
  const primaryTotal = primaryNumeric
    ? rows.reduce((acc, r) => acc + (typeof r[primaryNumeric.field] === "number" ? (r[primaryNumeric.field] as number) : 0), 0)
    : null;

  const statusField = activeColumns.find((c) => c.field === "status")?.field;
  const followUpField = activeColumns.find((c) => c.field === "follow_up_status")?.field;
  const attentionRows = rows.filter((row) => {
    const status = String((statusField && row[statusField]) ?? "");
    const follow = String((followUpField && row[followUpField]) ?? "");
    return status.includes("due_31") || status.includes("due_61") || follow === "todo" || follow === "in_progress";
  }).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 18 }}>
      {view.view_type === "follow_up_kanban" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {([["Todo", todoCount], ["In Progress", inProgressCount], ["Followed Up", followedUpCount], ["View", view.view_name]] as [string, string | number][]).map(([label, val]) => (
            <div key={label} style={{ background: "var(--bg-secondary)", borderRadius: "var(--r-card)", padding: 10 }}>
              <div style={{ fontSize: 10, color: "var(--ink-tertiary)", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {([["Rows", rows.length], ["Columns", activeColumns.length], ["Primary Total", primaryTotal === null ? "—" : eur(primaryTotal)], ["View", view.view_name]] as [string, string | number][]).map(([label, val]) => (
            <div key={label} style={{ background: "var(--bg-secondary)", borderRadius: "var(--r-card)", padding: 10 }}>
              <div style={{ fontSize: 10, color: "var(--ink-tertiary)", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--r-card)", padding: 10 }}>
        <div style={{ fontSize: 11, color: "var(--ink-tertiary)", marginBottom: 8 }}>
          {view.view_type === "follow_up_kanban" ? "Follow-up queue" : "Needs attention"}
        </div>
        {attentionRows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>No urgent items detected.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attentionRows.map((row, idx) => (
              <div key={`attention-${idx}`} style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                {String(row.client_name ?? row.invoice_id ?? `Row ${idx + 1}`)} — {String(row.status ?? row.follow_up_status ?? "review")}
              </div>
            ))}
          </div>
        )}
      </div>

      {view.view_type === "aging_table" ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {activeColumns.map((column) => (
                <th key={column.id} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "0.5px solid var(--line-thin)", color: "var(--ink-tertiary)", fontWeight: 500 }}>{column.label}</th>
              ))}
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "0.5px solid var(--line-thin)", color: "var(--ink-tertiary)", fontWeight: 500 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="data-row" key={`${String(row[rowKey] ?? "row")}-${index}`}>
                {activeColumns.map((column, ci) => {
                  const value = row[column.field];
                  return (
                    <td key={`${column.id}-${ci}`} style={{ padding: "10px", borderBottom: "0.5px solid var(--line-thin)" }}>
                      {column.kind === "number" && typeof value === "number" ? eur(value) : String(value ?? "")}
                    </td>
                  );
                })}
                <td style={{ padding: "10px", borderBottom: "0.5px solid var(--line-thin)" }}>
                  <button
                    disabled={row.follow_up_status === "followed_up" || !row.invoice_id || !!busy}
                    onClick={() => onMarkFollowedUp(String(row.invoice_id))}
                    className="btn-outline"
                    style={{ all: "unset", cursor: "pointer", fontSize: 11, padding: "4px 8px", borderRadius: 4, boxShadow: "inset 0 0 0 0.5px var(--line-strong)", color: "var(--ink-secondary)" }}
                  >
                    Mark followed up
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {view.view_type === "follow_up_kanban" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {lanes.map((lane) => (
            <div key={lane} style={{ background: "var(--bg-secondary)", borderRadius: "var(--r-card)", padding: 8 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-tertiary)", marginBottom: 8 }}>{lane}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.filter((r) => r.follow_up_status === lane).map((row, index) => (
                  <div key={String(row.invoice_id ?? index)} style={{ background: "var(--bg-surface)", borderRadius: 4, padding: "8px 9px", boxShadow: "inset 0 0 0 0.5px var(--line-thin)" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{String(row.invoice_id ?? "Item")}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 2 }}>{String(row.client_name ?? "")}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-tertiary)", marginTop: 2 }}>{typeof row.amount_cents === "number" ? eur(row.amount_cents) : ""}</div>
                    {lane !== "followed_up" ? (
                      <button
                        onClick={() => onMarkFollowedUp(String(row.invoice_id))}
                        className="btn-ghost"
                        style={{ all: "unset", cursor: "pointer", marginTop: 8, fontSize: 11, color: "var(--accent)", padding: "3px 6px", borderRadius: 4 }}
                      >
                        Mark followed up
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
