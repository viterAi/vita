/**
 * Meeting diarization (v0.1: content-cue inference via LLM).
 *
 * Acoustic diarization (pyannote / AssemblyAI / Deepgram) is the gold
 * standard but requires a paid provider key. As an L1 facet that adds value
 * even without that, this module asks an OpenRouter chat model to attribute
 * each sentence in a transcribed chunk to a speaker, given a small set of
 * speaker hints (e.g. "M = technical L-stack talk, S = strategic timekeeper,
 * Y = quieter infra"). The output is a JSON array of `{speaker, text, char_start, char_end}`
 * with a per-segment `confidence` (0-1).
 *
 * This automates exactly what was done by hand on 2026-04-30 to produce
 * `meetings/2026-04-30/shaul-yitzhak-car-ikea-speaker-confidence.md` — the
 * heuristic that was later superseded by real diarization in supercut.json.
 *
 * Two-facet model:
 *   - facet='diarization'         (this module)         — content-cue, cheap
 *   - facet='diarization_acoustic' (future)             — real audio model, slow + paid
 *
 * Both can co-exist on the same artifact. The active pointer flips when a
 * better one lands; staleness propagates to L2 syntheses automatically via
 * the existing `mark_l2_stale_on_active_flip` trigger.
 */
import type { LLMCallLogger } from '../../llm-log/index.js';
export declare const DIARIZE_DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
export declare const DIARIZE_EXTRACTOR_VERSION = "2026-05-05-content-cue";
export interface SpeakerHint {
    /** Short id, ideally one letter or short canonical-id. */
    id: string;
    /** Display name (full). */
    display: string;
    /** Free-text description of how this speaker sounds — used as the LLM's cue. */
    cues: string;
}
export interface DiarizedSegment {
    index: number;
    speaker: string;
    text: string;
    /** Char offsets within the chunk's input text. */
    char_start: number;
    char_end: number;
    /** Self-reported confidence 0-1. */
    confidence: number;
}
export interface DiarizeChunkArgs {
    openrouterApiKey: string;
    chunkIndex: number;
    /** The transcription text for this 10-min chunk (from transcribeMeeting output). */
    chunkText: string;
    speakers: SpeakerHint[];
    model?: string;
    /** Optional LLM-call logger. */
    logger?: LLMCallLogger;
    callerMetadata?: Record<string, string | number | null | undefined>;
    scopeKey?: string;
}
export interface DiarizeChunkResult {
    segments: DiarizedSegment[];
    modelUsed: string;
    promptCostUsd: number | null;
    completionTokens: number | null;
    wallMs: number;
    warning: string | null;
}
export declare function diarizeChunk(args: DiarizeChunkArgs): Promise<DiarizeChunkResult>;
/**
 * Diarize a whole meeting by running diarizeChunk over the transcription
 * chunks. Each chunk is independent — segments don't bridge chunk boundaries.
 */
export declare function diarizeMeeting(args: {
    openrouterApiKey: string;
    /** Output of transcribeMeeting() — pass `result.chunks`. */
    chunks: Array<{
        index: number;
        startSec: number;
        durationSec: number;
        text: string;
    }>;
    speakers: SpeakerHint[];
    model?: string;
    logger?: LLMCallLogger;
    callerMetadata?: Record<string, string | number | null | undefined>;
    scopeKey?: string;
    concurrency?: number;
}): Promise<{
    perChunk: DiarizeChunkResult[];
    /** Flat segment list with chunk-relative offsets remapped to whole-meeting indices. */
    segments: Array<DiarizedSegment & {
        chunk_index: number;
        ts_start_s: number;
        ts_end_s: number;
    }>;
    modelUsed: string;
}>;
//# sourceMappingURL=diarize.d.ts.map