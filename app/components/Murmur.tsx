"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth/UserContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  sourceName: string;
  pageTitle: string;
  generating: boolean;
  isRefreshingContent: boolean;
  isSaved: boolean;
};

export function Murmur({ sourceName, pageTitle, generating, isRefreshingContent, isSaved }: Props) {
  const router = useRouter();
  const { user } = useUser();

  const statusText = generating
    ? "Generating…"
    : isRefreshingContent
    ? "Refreshing…"
    : isSaved
    ? "Saved"
    : sourceName
    ? "Draft"
    : "";

  const statusColor = generating || isRefreshingContent
    ? "var(--accent)"
    : isSaved
    ? "var(--good)"
    : "var(--ink-tertiary)";

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const email = user?.email ?? "";
  const initials = email
    ? email[0].toUpperCase()
    : "?";

  return (
    <div style={{
      height: 32,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      paddingInline: 12,
      gap: 0,
      background: "var(--bg-surface)",
      borderRadius: "var(--r-zone)",
      boxShadow: "inset 0 0 0 0.5px var(--line-thin)",
    }}>
      {/* Left — logo */}
      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="4" fill="#2f5bff"/>
          <path d="M4.5 4.5L8 11.5L11.5 4.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink-primary)" }}>
          vita
        </span>
      </span>

      {/* Centre — breadcrumb + status */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0 }}>
        {sourceName && (
          <>
            <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>{sourceName}</span>
            {pageTitle && (
              <>
                <span style={{ fontSize: 11, color: "var(--ink-quaternary, var(--line-strong))" }}>›</span>
                <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>{pageTitle}</span>
              </>
            )}
          </>
        )}
        {statusText && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: sourceName ? 8 : 0 }}>
            {(generating || isRefreshingContent) && (
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: statusColor,
                display: "inline-block",
                animation: "pulse-dot 1.4s ease-in-out infinite",
              }} />
            )}
            {isSaved && !generating && !isRefreshingContent && (
              <span style={{ fontSize: 10, color: statusColor }}>✓</span>
            )}
            <span style={{ fontSize: 11, color: statusColor }}>{statusText}</span>
          </div>
        )}
      </div>

      {/* Right — user profile + logout */}
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Avatar */}
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--accent-tint)",
            border: "0.5px solid var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: 0,
          }}>
            {initials}
          </div>

          {/* Email */}
          <span style={{
            fontSize: 11,
            color: "var(--ink-secondary)",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {email}
          </span>

          {/* Divider */}
          <span style={{ width: 0.5, height: 12, background: "var(--line-strong)", flexShrink: 0 }} />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn-ghost"
            style={{
              padding: "2px 7px",
              height: 20,
              background: "transparent",
              border: "0.5px solid var(--line-strong)",
              borderRadius: "var(--r-card)",
              fontSize: 11,
              color: "var(--ink-tertiary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M4 2H2.5A.5.5 0 0 0 2 2.5v5a.5.5 0 0 0 .5.5H4" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              <path d="M6.5 3.5L8 5l-1.5 1.5M8 5H4.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
