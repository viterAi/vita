/**
 * Image extraction (Phase 5) via OpenRouter `google/gemini-3.1-flash-lite-preview`.
 *
 * Why this model: native multimodal (text + image + audio + video + file),
 * 1M context, $0.25/M image tokens, structured outputs supported. Same model
 * we'll use for image input so the cache + ops surface stays unified.
 *
 * Output:
 *   text  = OCR'd text + 1-paragraph visual description
 *   segments = one per detected region (chart / table / text-block / face) when present
 *   language = detected from any text in the image
 */
import type { ExtractionInput, ExtractionResult, ExtractorContext } from './types';
export declare const IMAGE_DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
export declare const IMAGE_EXTRACTOR_VERSION = "2026-05-04";
export declare function extractImage(input: ExtractionInput, ctx: ExtractorContext): Promise<ExtractionResult>;
//# sourceMappingURL=image.d.ts.map