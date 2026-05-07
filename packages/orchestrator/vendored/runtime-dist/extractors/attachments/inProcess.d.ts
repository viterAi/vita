/**
 * Free, deterministic, local extractors — DOCX, XLSX, HTML, MD, JSON, plain text.
 *
 * No network, no LLM, no fees. Same input → same output, every time.
 */
import type { ExtractionInput, ExtractionResult } from './types';
export declare function extractDocx(input: ExtractionInput): Promise<ExtractionResult>;
export declare function extractXlsx(input: ExtractionInput): ExtractionResult;
export declare function extractHtml(input: ExtractionInput): ExtractionResult;
export declare function extractMarkdown(input: ExtractionInput): ExtractionResult;
export declare function extractPlainText(input: ExtractionInput): ExtractionResult;
export declare function extractJson(input: ExtractionInput): ExtractionResult;
//# sourceMappingURL=inProcess.d.ts.map