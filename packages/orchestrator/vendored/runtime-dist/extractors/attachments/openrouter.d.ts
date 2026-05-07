/**
 * Shared OpenRouter helpers for the LLM-routed attachment extractors.
 *
 * One key, three endpoints:
 *   - /v1/audio/transcriptions   (whisper-class models, JSON body w/ input_audio)
 *   - /v1/chat/completions       (multimodal models — gemini family for PDF/image)
 */
export interface OpenRouterTranscriptionResponse {
    text?: string;
    language?: string;
    duration?: number;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    model?: string;
    provider?: string;
    id?: string;
    usage?: {
        seconds?: number;
        cost?: number;
    };
    error?: {
        message?: string;
        code?: string;
    } | string;
}
export declare function postTranscription(args: {
    apiKey: string;
    model: string;
    audioB64: string;
    format: 'wav' | 'mp3' | 'opus' | 'm4a' | 'flac';
    /**
     * Caller metadata forwarded to OpenRouter as request-level `metadata`. OR's
     * Broadcast feature surfaces these as `trace.metadata.*` OTLP attributes —
     * the openrouter-webhook reads them to stamp the llm_call_log row with
     * tenant_id / caller / scope / trigger_run_id. Pass at minimum tenant_id.
     */
    callerMetadata?: Record<string, string | number | null | undefined>;
    /** Whisper vocab biasing — seeds Whisper with proper nouns (best on noisy mixed-language audio). */
    prompt?: string;
    /** ISO 639-1 language hint, e.g. 'en' or 'he'. */
    language?: string;
}): Promise<OpenRouterTranscriptionResponse>;
export interface OpenRouterChatResponse {
    id?: string;
    model?: string;
    provider?: string;
    choices?: Array<{
        message?: {
            content?: string | null;
        };
        finish_reason?: string;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    error?: {
        message?: string;
        code?: string;
    } | string;
}
export declare function postChatCompletion(args: {
    apiKey: string;
    model: string;
    body: Record<string, unknown>;
    callerMetadata?: Record<string, string | number | null | undefined>;
}): Promise<OpenRouterChatResponse>;
//# sourceMappingURL=openrouter.d.ts.map