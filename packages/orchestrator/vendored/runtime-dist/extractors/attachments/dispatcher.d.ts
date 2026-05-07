/**
 * Single-entry dispatcher for attachment extraction.
 *
 * mime/extension → handler:
 *   audio/*                                  → whisper-large-v3-turbo (OpenRouter)
 *   image/*                                  → gemini-3.1-flash-lite-preview (OpenRouter)
 *   application/pdf                          → gemini-2.5-flash-lite (OpenRouter)
 *   application/vnd.openxmlformats-…wordprocessingml → mammoth (in-process)
 *   application/vnd.openxmlformats-…spreadsheetml    → sheetjs (in-process)
 *   text/html                                → regex strip (in-process)
 *   text/markdown                            → identity (in-process)
 *   application/json                         → JSON pretty (in-process)
 *   text/*                                   → identity (in-process)
 *   else                                     → null (skip — zip, video, binary)
 *
 * Returns null when the mime/extension is unsupported. Caller treats null as
 * "skip" rather than "fail."
 */
import type { ExtractionInput, ExtractionResult, ExtractorContext } from './types';
export declare function dispatchExtract(input: ExtractionInput, ctx: ExtractorContext): Promise<ExtractionResult | null>;
export * from './types';
export { AUDIO_DEFAULT_MODEL, AUDIO_EXTRACTOR_VERSION, } from './audio';
export { PDF_DEFAULT_MODEL, PDF_EXTRACTOR_VERSION, } from './pdf';
export { IMAGE_DEFAULT_MODEL, IMAGE_EXTRACTOR_VERSION, } from './image';
//# sourceMappingURL=dispatcher.d.ts.map