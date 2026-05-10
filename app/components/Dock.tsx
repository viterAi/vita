"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STEER_HINTS } from "../utils";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  steerMessages: Message[];
  steerInput: string;
  setSteerInput: (v: string) => void;
  steering: boolean;
  steerHintIdx: number;
  sendSteerMessage: () => void;
  sourceId: string;
  hasPages: boolean;
  steerScrollRef: React.RefObject<HTMLDivElement | null>;
};

const COLLAPSED_H = 52;
const EXPANDED_H = 260;

export function Dock({
  steerMessages, steerInput, setSteerInput,
  steering, steerHintIdx,
  sendSteerMessage, sourceId, hasPages,
  steerScrollRef,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-expand when messages arrive
  useEffect(() => {
    if (steerMessages.length > 0) setExpanded(true);
  }, [steerMessages.length]);

  function handleInputFocus() {
    if (hasPages) setExpanded(true);
  }

  const canSend = !steering && !!steerInput.trim() && !!sourceId && hasPages;
  const isOpen = expanded && hasPages;

  return (
    <div style={{
      flexShrink: 0,
      background: "var(--bg-surface)",
      borderRadius: "var(--r-zone)",
      boxShadow: "inset 0 0 0 0.5px var(--line-thin)",
      display: "flex",
      flexDirection: "column",
      height: isOpen ? EXPANDED_H : COLLAPSED_H,
      transition: "height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
      overflow: "hidden",
    }}>

      {/* Message history — only shown when expanded */}
      <div
        ref={steerScrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isOpen ? "12px 16px 8px" : "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 0,
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        {steerMessages.length === 0 && isOpen ? (
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)", lineHeight: 1.6 }}>
            Ask to change what you see — e.g. &ldquo;show only overdue items&rdquo; or &ldquo;add a chart by client&rdquo;.
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {steerMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                padding: "7px 11px",
                borderRadius: 10,
                background: msg.role === "user" ? "var(--accent)" : "var(--bg-secondary)",
                color: msg.role === "user" ? "white" : "var(--ink-secondary)",
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "76%",
                boxShadow: msg.role === "user" ? "0 1px 4px rgba(47,91,255,0.18)" : "none",
              }}
            >
              {msg.content}
            </motion.div>
          ))}
        </AnimatePresence>

        {steering ? (
          <div style={{ alignSelf: "flex-start", width: "60%", display: "flex", flexDirection: "column", gap: 6, padding: "6px 0" }}>
            <div className="chat-skeleton-line" style={{ width: "100%" }} />
            <div className="chat-skeleton-line" style={{ width: "78%" }} />
            <div className="chat-hint-cycle" style={{ marginTop: 2, fontSize: 11, color: "var(--ink-tertiary)" }}>
              {STEER_HINTS[steerHintIdx]}
            </div>
          </div>
        ) : null}
      </div>

      {/* Input bar — always visible */}
      <div style={{
        padding: "8px 10px",
        flexShrink: 0,
        borderTop: isOpen ? "0.5px solid var(--line-thin)" : "none",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          borderRadius: 8,
          border: "1px solid var(--line-strong)",
          background: "var(--bg-secondary)",
          overflow: "hidden",
          transition: "border-color 0.15s",
        }}>
          {isOpen && (
            <button
              onClick={() => setExpanded(false)}
              style={{
                all: "unset", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, margin: "0 4px",
                borderRadius: 6,
                background: "var(--bg-tertiary)",
                color: "var(--ink-secondary)",
                flexShrink: 0,
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--line-strong)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tertiary)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-secondary)";
              }}
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <input
            ref={inputRef}
            value={steerInput}
            onChange={(e) => setSteerInput(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendSteerMessage(); } }}
            placeholder={hasPages ? "Ask to change the view…" : "Generate a view first"}
            disabled={steering || !sourceId}
            suppressHydrationWarning
            style={{
              flex: 1, fontSize: 12, padding: "10px 12px",
              border: "none", background: "transparent",
              color: "var(--ink-primary)", outline: "none", minWidth: 0,
            }}
          />
          <button
            onClick={() => void sendSteerMessage()}
            disabled={!canSend}
            className={canSend ? "btn-solid" : undefined}
            style={{
              all: "unset",
              cursor: canSend ? "pointer" : "default",
              fontSize: 14, width: 32, height: 32, margin: 4, borderRadius: 6,
              background: canSend ? "var(--ink-primary)" : "var(--bg-tertiary)",
              color: canSend ? "white" : "var(--ink-quaternary, var(--ink-tertiary))",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.15s, color 0.15s",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
