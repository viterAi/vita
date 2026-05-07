/**
 * Live WhatsApp message extractor.
 *
 * Companion to the Edge Function `whatsapp-webhook`. The EF does the hot-path
 * insert directly (for low latency); this module exposes the same logic as a
 * pure TypeScript function so:
 *   - tests can exercise it without spinning up a Deno EF
 *   - backfill scripts can replay raw webhook payloads from a log
 *   - future cron jobs (e.g. alias backfill) can re-process events
 *
 * The Edge Function copy and this module should produce identical row shapes.
 * If they diverge, this is the canonical reference; mirror back to the EF.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
export interface WhatsAppLiveMessageInput {
    tenantId: string;
    /** Resolved channel id (already created/looked up by the caller) */
    channelId: string;
    /** GOWA device id this message came in on */
    gowaDeviceId: string;
    /** Raw GOWA message data (passes through as l1_event.metadata.raw) */
    msg: {
        id: string;
        chat_id: string;
        from_id: string;
        from_me?: boolean;
        push_name?: string;
        timestamp: string;
        is_group?: boolean;
        group_id?: string;
        group_subject?: string;
        message_type: string;
        text?: string;
        media?: {
            url?: string;
            mime_type?: string;
            filename?: string;
            bytes?: number;
            sha256?: string;
            caption?: string;
            duration_seconds?: number;
        };
        quoted_message_id?: string;
        mentions?: string[];
    };
}
export interface WhatsAppLiveMessageResult {
    l0_artifact_id: string;
    l1_event_id?: string | undefined;
    needs_extraction: boolean;
    resolved_actor_id: string | null;
}
/**
 * Process one live WhatsApp message: insert l0_artifact, attempt principal
 * alias resolution for the sender, insert l1_event if text (no extractor
 * needed) or mark needs_extraction=true if media (caller fires the extractor).
 *
 * Idempotent: if (tenant_id, gowa_message_id) already exists, returns the
 * existing l0 row id. Safe to replay.
 */
export declare function ingestLiveMessage(db: SupabaseClient, input: WhatsAppLiveMessageInput): Promise<WhatsAppLiveMessageResult>;
//# sourceMappingURL=index.d.ts.map