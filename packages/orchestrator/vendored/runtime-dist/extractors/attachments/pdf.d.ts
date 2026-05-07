/**
 * PDF extraction via OpenRouter `google/gemini-2.5-flash-lite`.
 *
 * Cheap, multilingual, handles Hebrew transfer slips cleanly per Phase 4
 * end-to-end on the Shaul DM.
 *
 * Filenames with spaces/parens trip OpenRouter's parser plugin — we sanitize.
 */
import type { ExtractionInput, ExtractionResult, ExtractorContext } from './types';
export declare const PDF_DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
export declare const PDF_EXTRACTOR_VERSION = "2026-05-04";
export declare function extractPdf(input: ExtractionInput, ctx: ExtractorContext): Promise<ExtractionResult>;
//# sourceMappingURL=pdf.d.ts.map