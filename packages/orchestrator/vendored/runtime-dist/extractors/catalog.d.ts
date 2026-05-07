/**
 * Extractor catalog — single TS source of truth for `extractor_metadata`.
 *
 * Mirrors the rows in `public.extractor_metadata`. The DB table is the
 * queryable surface; this module is the editable surface — when you add
 * an extractor, edit it here, then run `scripts/sync-extractor-metadata.ts`
 * to push to Supabase.
 *
 * Lookup keys match `extractor_metadata.id` exactly:
 *   - Production:  `<extractor>@<version>` (matches l1_extraction_runs.extractor + version)
 *   - Candidates:  `<provider>:<family>:<facet>@<date>` (no run rows yet)
 */
export type ExtractorFamily = 'attachment' | 'meeting' | 'whatsapp' | 'session_log' | 'synthesis' | 'evaluation';
export type ExtractorFacet = 'transcription' | 'transcription_diarization_bundled' | 'diarization' | 'image_caption' | 'doc_chunks' | 'doc_text' | 'tabular_csv' | 'plain_text' | 'turn_text' | 'tool_calls' | 'messages' | 'day_l2' | 'wer_cer_benchmark';
export type ExtractorIntendedStatus = 'active' | 'candidate' | 'deprecated' | 'experiment';
export type ExtractorProvider = 'in-process' | 'openrouter' | 'anthropic' | 'assemblyai' | 'xai' | 'elevenlabs' | 'pyannoteai' | 'multi';
export interface PricingModel {
    unit: 'audio_second' | 'audio_hour_bundled' | 'audio_hour_diarization_only' | 'input_token' | 'output_token' | 'in_process' | 'input_token + output_token';
    approx_usd_per_hour?: number;
    approx_usd_per_image?: number;
    approx_usd_per_page?: number;
    approx_usd_per_meeting?: number;
    approx_usd_per_synthesis?: number;
    currency_native?: string;
    breakdown?: Record<string, number>;
}
export interface BenchmarkData {
    audio?: string;
    wer?: number;
    cer?: number;
    speaker_share_drift_pp?: number[];
    wall_seconds_for_41_min?: number;
    chunks?: number;
    validated?: string;
    notes?: string;
}
export interface CatalogEntry {
    id: string;
    family: ExtractorFamily;
    facet: ExtractorFacet;
    source_types: string[];
    intended_status: ExtractorIntendedStatus;
    provider: ExtractorProvider;
    pricing_model: PricingModel;
    benchmark_data?: BenchmarkData;
    notes: string;
    superseded_by?: string;
}
export declare const CATALOG: CatalogEntry[];
/** Returns the catalog entry for an extractor id (`<extractor>@<version>`). */
export declare function getCatalogEntry(id: string): CatalogEntry | undefined;
/** Returns all entries with a given intended status. */
export declare function getCatalogByStatus(status: ExtractorIntendedStatus): CatalogEntry[];
/** Returns all entries that can produce events for a given source_type + facet. */
export declare function getCatalogByCapability(source_type: string, facet: ExtractorFacet): CatalogEntry[];
/** Get the full catalog. Used by sync script + introspection tools. */
export declare function getCatalog(): CatalogEntry[];
//# sourceMappingURL=catalog.d.ts.map