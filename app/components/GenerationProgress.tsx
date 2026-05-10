"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ProgressStep } from "../types";

type Props = {
  progressLog: ProgressStep[];
};

function statusFromLog(log: ProgressStep[]): { text: string; sub: string | null } {
  if (log.length === 0) return { text: "Starting up…", sub: null };
  for (let i = log.length - 1; i >= 0; i--) {
    const s = log[i];
    if (s.type === "page_done") return { text: `✓ "${s.title}" ready`, sub: null };
    if (s.type === "page_start") return { text: `Building "${s.title}"…`, sub: null };
    if (s.type === "page_attempt" && s.attempt > 1) return { text: `Retrying "${s.page_id}"…`, sub: null };
    if (s.type === "plan_ready") {
      const n = s.pages.length;
      return { text: `Plan ready — ${n} page${n !== 1 ? "s" : ""}`, sub: s.pages.map((p) => p.title).join(" · ") };
    }
    if (s.type === "planning") return { text: "Reading your data…", sub: null };
  }
  return { text: "Working…", sub: null };
}

const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--bg-secondary) 0%, var(--bg-tertiary, #f0ece8) 50%, var(--bg-secondary) 100%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
  borderRadius: 6,
};

function SkeletonBlock({ h, w = "100%", opacity = 1 }: { h: number; w?: string | number; opacity?: number }) {
  return <div style={{ ...shimmer, height: h, width: w, flexShrink: 0, opacity }} />;
}

export function GenerationProgress({ progressLog }: Props) {
  const { text, sub } = statusFromLog(progressLog);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Status chip */}
      <motion.div
        key={text}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start",
          padding: "5px 11px", borderRadius: 20,
          background: "var(--bg-secondary)",
          boxShadow: "inset 0 0 0 0.5px var(--line-thin)",
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent)", flexShrink: 0,
          animation: "pulse-dot 1.4s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-secondary)" }}>{text}</span>
        {sub && <span style={{ fontSize: 10, color: "var(--ink-tertiary)" }}>{sub}</span>}
      </motion.div>

      {/* KPI row skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...shimmer, borderRadius: 10, padding: 16, height: 78, opacity: 1 - i * 0.06 }}>
            <div style={{ height: 10, width: "50%", background: "rgba(0,0,0,0.07)", borderRadius: 4, marginBottom: 10 }} />
            <div style={{ height: 22, width: "70%", background: "rgba(0,0,0,0.09)", borderRadius: 5 }} />
          </div>
        ))}
      </div>

      {/* Text block skeleton */}
      <div style={{ ...shimmer, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, height: 88 }}>
        <div style={{ height: 10, width: "30%", background: "rgba(0,0,0,0.07)", borderRadius: 4 }} />
        <div style={{ height: 8, width: "92%", background: "rgba(0,0,0,0.05)", borderRadius: 4 }} />
        <div style={{ height: 8, width: "80%", background: "rgba(0,0,0,0.05)", borderRadius: 4 }} />
        <div style={{ height: 8, width: "60%", background: "rgba(0,0,0,0.04)", borderRadius: 4 }} />
      </div>

      {/* Two-column row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ ...shimmer, borderRadius: 10, padding: 16, height: 140 }}>
          <div style={{ height: 10, width: "45%", background: "rgba(0,0,0,0.07)", borderRadius: 4, marginBottom: 14 }} />
          {[0.7, 0.9, 0.55, 0.8].map((w, i) => (
            <div key={i} style={{ height: 8, width: `${w * 100}%`, background: "rgba(0,0,0,0.05)", borderRadius: 4, marginBottom: 8 }} />
          ))}
        </div>
        <div style={{ ...shimmer, borderRadius: 10, padding: 16, height: 140 }}>
          <div style={{ height: 10, width: "40%", background: "rgba(0,0,0,0.07)", borderRadius: 4, marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80, paddingBottom: 8 }}>
            {[0.5, 0.8, 0.6, 1, 0.75, 0.45, 0.9].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h * 100}%`, background: "rgba(0,0,0,0.08)", borderRadius: "3px 3px 0 0" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div style={{ ...shimmer, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: 36, background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", paddingInline: 16, gap: 20 }}>
          {[120, 80, 90, 60, 70].map((w, i) => (
            <div key={i} style={{ height: 8, width: w, background: "rgba(0,0,0,0.08)", borderRadius: 4 }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} style={{ height: 34, display: "flex", alignItems: "center", paddingInline: 16, gap: 20, borderTop: "0.5px solid rgba(0,0,0,0.04)" }}>
            {[100, 70, 80, 55, 65].map((w, i) => (
              <div key={i} style={{ height: 7, width: w * (0.7 + Math.sin(row * 3 + i) * 0.3), background: "rgba(0,0,0,0.05)", borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>

      {/* Completed pages log — subtle, at bottom */}
      <AnimatePresence>
        {progressLog.filter((s) => s.type === "page_done").length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2 }}
          >
            {progressLog.filter((s) => s.type === "page_done").map((s, i) =>
              s.type === "page_done" ? (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ fontSize: 10, color: "var(--good)", background: "var(--good-tint)", borderRadius: 10, padding: "2px 8px" }}
                >
                  ✓ {s.title}
                </motion.span>
              ) : null
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
