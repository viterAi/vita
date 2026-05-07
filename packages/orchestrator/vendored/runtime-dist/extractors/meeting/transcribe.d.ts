/**
 * Long-form audio transcription, chunked.
 *
 * The single-file `attachments/audio.ts` extractor is fine for WhatsApp voice
 * notes (≤2 min). Meetings are 30–120 min and overflow Whisper's per-call
 * envelope, so we chunk with ffmpeg first, then transcribe chunks
 * sequentially (or with bounded parallelism), then stitch.
 *
 * Config baked in from the 2026-05-05 morning bake-off:
 *   - extractor:    openai/whisper-large-v3-turbo
 *   - chunk size:   10 minutes (best WER vs cost trade-off in benchmark)
 *   - bias prompt:  proper-noun seed (Mordechai, Shaul, Yitzchak, …)
 *   - input format: 16-kHz mono pcm_s16le wav (transcoded from any source)
 *
 * Reference benchmark on Ahiya 2026-05-05: WER 12.58 / CER 9.73 on 90 min.
 */
import type { LLMCallLogger } from '../../llm-log/index.js';
export declare const MEETING_DEFAULT_MODEL = "openai/whisper-large-v3-turbo";
export declare const MEETING_EXTRACTOR_VERSION = "2026-05-05";
export declare const MEETING_DEFAULT_CHUNK_MIN = 10;
/**
 * Default bias prompt — proper nouns + project vocab. Seeds Whisper so it
 * doesn't transcribe "Yitzchak" as "It's hawk" etc. This is the prompt that
 * won the bake-off when paired with whisper-large-v3-turbo.
 */
export declare const MEETING_DEFAULT_BIAS_PROMPT: string;
export interface MeetingChunk {
    index: number;
    startSec: number;
    durationSec: number;
    /** Local wav path (transient — caller should rmSync the parent dir). */
    wavPath: string;
}
export interface MeetingChunkTranscript {
    index: number;
    startSec: number;
    durationSec: number;
    text: string;
    language: string | null;
    segments: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    /** Bytes of the wav sent to OpenRouter (post-transcode). */
    wavBytes: number;
    /** sha256 of the wav payload — useful for idempotency / dedup. */
    wavSha256: string;
    /** Provider-reported audio seconds, when present (Whisper bills per-second). */
    audioSeconds: number | null;
    /** Provider-reported cost in USD, when present. */
    costUsd: number | null;
    /** Wall-clock ms for the OpenRouter call. */
    wallMs: number;
}
export interface MeetingTranscribeArgs {
    /** Local path to the audio file (any container ffmpeg can read). */
    audioPath: string;
    openrouterApiKey: string;
    model?: string;
    chunkMinutes?: number;
    /**
     * Cap the transcription at the first N minutes. 0 = full file. Useful for
     * smoke tests. Default 0.
     */
    maxMinutes?: number;
    biasPrompt?: string | null;
    languageHint?: string;
    /**
     * Optional logger — if present, every chunk transcription writes a row to
     * `llm_call_log`. The trigger task constructs one and threads it in.
     */
    logger?: LLMCallLogger;
    /** Caller metadata forwarded to OpenRouter as request `metadata`. */
    callerMetadata?: Record<string, string | number | null | undefined>;
    /** Bound the chunk-level concurrency. Default 1 (sequential). */
    concurrency?: number;
    /** Scope key for llm_call_log rows. Caller passes meeting slug or sha. */
    scopeKey?: string;
}
export interface MeetingTranscribeResult {
    chunks: MeetingChunkTranscript[];
    totalDurationS: number;
    totalChars: number;
    modelUsed: string;
    version: string;
    chunkMinutes: number;
    biasPromptHash: string | null;
    audioSha256: string;
    audioBytes: number;
}
/**
 * Chunk an audio file and transcribe each chunk. Caller is responsible for
 * downloading the audio to a local path and persisting the resulting events.
 */
export declare function transcribeMeeting(args: MeetingTranscribeArgs): Promise<MeetingTranscribeResult>;
//# sourceMappingURL=transcribe.d.ts.map