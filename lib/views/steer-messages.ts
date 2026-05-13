export type SteerMessage = { role: "user" | "assistant"; content: string };

const MAX_PERSISTED = 80;

export function normalizeSteerMessages(raw: unknown): SteerMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SteerMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = (item as { content?: string }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content });
  }
  return out;
}

export function steerMessagesFromUiState(ui: unknown): SteerMessage[] {
  if (!ui || typeof ui !== "object") return [];
  return normalizeSteerMessages((ui as { steer_messages?: unknown }).steer_messages);
}

export function capSteerMessages(messages: SteerMessage[]): SteerMessage[] {
  if (messages.length <= MAX_PERSISTED) return messages;
  return messages.slice(messages.length - MAX_PERSISTED);
}
