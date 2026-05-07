/**
 * AssemblyAI Universal — bundled transcription + speaker diarization.
 *
 * Validated 2026-05-05 against the 04-30 "shaul-yitzhak-car-ikea" supercut:
 *   WER 22.77% · speaker share drift 0.3/0.9/1.3 pp · 6 s wall for 41 min
 *   Cost $0.116 for 41 min ($0.17/hr bundled: $0.15 transcription + $0.02 diarization)
 *
 * One API call (no chunking needed). AssemblyAI handles audio of any length
 * server-side. Returns utterances with per-word speaker labels.
 *
 * Flow:
 *   1. Upload audio bytes → upload_url
 *   2. POST /v2/transcript { audio_url, speaker_labels, speakers_expected? }
 *   3. Poll /v2/transcript/{id} until status=completed|error
 *   4. Return utterances (speaker-attributed segments) + full text
 */
export declare const ASSEMBLYAI_EXTRACTOR_VERSION = "2026-05-05";
export declare const ASSEMBLYAI_MODEL_ID = "assemblyai:universal@2026-05-05";
export interface AssemblyAIUtterance {
    speaker: string;
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
    words: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
        speaker: string;
    }>;
}
export interface AssemblyAITranscribeArgs {
    apiKey: string;
    /** Local file path or readable buffer. */
    audioPath: string;
    /** Optional hint for number of speakers (improves diarization accuracy). */
    speakersExpected?: number;
    /** ISO 639-1 language code. Default: auto-detect. */
    language?: string;
    /** Poll interval in ms. Default 2000. */
    pollIntervalMs?: number;
    /** Max total wait seconds. Default 600 (10 min). */
    maxWaitSec?: number;
}
export interface AssemblyAITranscribeResult {
    transcript_id: string;
    text: string;
    utterances: AssemblyAIUtterance[];
    /** Total audio duration in seconds. */
    duration_s: number;
    /** Language detected or passed in. */
    language: string | null;
    /** Wall-clock ms for the whole operation. */
    wall_ms: number;
    /** Approximate cost in USD. */
    cost_usd: number | null;
}
export declare function transcribeWithAssemblyAI(args: AssemblyAITranscribeArgs): Promise<AssemblyAITranscribeResult>;
//# sourceMappingURL=assemblyai.d.ts.map