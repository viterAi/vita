"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Logo mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="4" fill="#2f5bff" />
          <path
            d="M4.5 4.5L8 11.5L11.5 4.5"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--ink-primary)",
          }}
        >
          vita
        </span>
      </div>

      {/* Card */}
      <div
        style={{
          width: 340,
          background: "var(--bg-surface)",
          borderRadius: "var(--r-zone)",
          boxShadow: "var(--shadow-card)",
          border: "0.5px solid var(--line-thin)",
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "0.5px solid var(--line-thin)",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Sign in
          </div>
          <div
            style={{ fontSize: 12, color: "var(--ink-tertiary)", marginTop: 2 }}
          >
            Enter your credentials to continue.
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "20px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-secondary)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={{
                padding: "8px 10px",
                background: "var(--bg-secondary)",
                border: "0.5px solid var(--line-strong)",
                borderRadius: "var(--r-card)",
                color: "var(--ink-primary)",
                fontSize: 13,
                outline: "none",
                transition: "border-color 0.12s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "var(--bg-surface)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line-strong)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-secondary)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                padding: "8px 10px",
                background: "var(--bg-secondary)",
                border: "0.5px solid var(--line-strong)",
                borderRadius: "var(--r-card)",
                color: "var(--ink-primary)",
                fontSize: 13,
                outline: "none",
                transition: "border-color 0.12s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "var(--bg-surface)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line-strong)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--danger-tint)",
                border: "0.5px solid var(--danger)",
                borderRadius: "var(--r-card)",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-solid"
            style={{
              marginTop: 2,
              padding: "9px 16px",
              background: "var(--accent)",
              border: "none",
              borderRadius: "var(--radius-button)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
