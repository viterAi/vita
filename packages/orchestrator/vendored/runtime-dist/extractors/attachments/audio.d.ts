/**
 * Audio transcription via OpenRouter `openai/whisper-large-v3-turbo`.
 *
 * Input: opus / wav / mp3 bytes. opus gets transcoded to wav with ffmpeg first
 * (the OpenRouter endpoint accepts only wav/mp3 from the openai whisper
 * provider per testing on 2026-05-04).
 */
import type { ExtractionInput, ExtractionResult, ExtractorContext } from './types';
export declare const AUDIO_DEFAULT_MODEL = "openai/whisper-large-v3-turbo";
export declare const AUDIO_EXTRACTOR_VERSION = "2026-05-04";
export declare function extractAudio(input: ExtractionInput, ctx: ExtractorContext): Promise<ExtractionResult>;
//# sourceMappingURL=audio.d.ts.map