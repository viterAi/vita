/**
 * Universal LLM call logger.
 *
 * Every OpenRouter (or direct-Anthropic) call should funnel through one of two
 * code paths that own the `llm_call_log` row lifecycle:
 *
 *   1. Synthesizer (`packages/runtime/src/synthesizers/synthesizer.ts`) — already
 *      writes its own row and back-links the result.
 *
 *   2. Attachment extractors (audio / image / pdf) — historically did NOT log,
 *      which is the gap this module closes. The trigger.dev task constructs
 *      a logger and threads it through `ExtractorContext`; standalone scripts
 *      can construct one too.
 *
 * Logging is best-effort: a failure to insert/update should NEVER take down
 * the actual LLM call. We swallow errors with a console.warn.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
export interface LLMCallStartArgs {
    model: string;
    parameters?: Record<string, unknown>;
    promptVersion?: string;
    scopeKind?: string;
    scopeKey?: string;
    callerRef?: string;
    systemPromptHash?: string;
    userPromptChars?: number;
    userPromptHash?: string;
    audioSeconds?: number;
    audioFormat?: string;
    audioBytes?: number;
    audioLanguage?: string;
    outputKind?: string;
    rawRequest?: Record<string, unknown>;
}
export interface LLMCallFinishArgs {
    status: 'ok' | 'failed' | 'timeout' | 'cancelled';
    modelUsed?: string | null;
    providerName?: string | null;
    generationId?: string | null;
    finishReason?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    reasoningTokens?: number | null;
    cachedTokens?: number | null;
    totalTokens?: number | null;
    costUsd?: number | null;
    latencyMs: number;
    generationTimeMs?: number | null;
    errorMessage?: string | null;
    errorCode?: string | null;
    /** Small redacted response — bytes/base64 stripped; safe to persist. */
    rawResponse?: Record<string, unknown> | null;
    /** Free-form per-call metrics merged into row.metadata jsonb. */
    metadataExtra?: Record<string, unknown>;
}
export interface LLMCallLogger {
    start(args: LLMCallStartArgs): Promise<string | null>;
    finish(id: string | null, args: LLMCallFinishArgs): Promise<void>;
}
export interface LLMCallLoggerSpec {
    db: SupabaseClient;
    tenantId: string;
    caller: string;
    /** Trigger.dev run id, when invoked from a trigger task — stamped into metadata for filterability. */
    triggerRunId?: string;
    /** Trigger.dev task id ('extract-attachment', 'ingest-zip', …). */
    triggerTaskId?: string;
    /** Free-form provenance — script path or task id. */
    source?: string;
    /** OpenTelemetry session id (e.g. one trigger.dev run = one session). */
    sessionId?: string;
    /** dev | staging | prod — used by the rollup view to gate prod cost alerts. */
    environment?: string;
    /** Default tags — appended to row.tags on insert. */
    tags?: string[];
}
export declare function createLLMCallLogger(spec: LLMCallLoggerSpec): LLMCallLogger;
/** Wrap any async OpenRouter call so a logger row is opened/closed automatically. */
export declare function withLLMCallLog<T>(logger: LLMCallLogger | undefined, startArgs: LLMCallStartArgs, fn: () => Promise<{
    result: T;
    finishExtras?: Partial<LLMCallFinishArgs>;
}>): Promise<T>;
//# sourceMappingURL=index.d.ts.map