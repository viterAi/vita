'use server';

/**
 * Server actions for the meetings upload surface.
 *
 * Flow: browser calls ensureMeetingChannel → gets back a signed upload URL
 * (per file, generated via service-role). Browser uploads directly to the
 * signed URL — no browser auth or RLS evaluation on the upload itself.
 *
 * Signed URLs are single-use, expire in 60 s, and are scoped to the exact
 * storage path. The inbox-webhook Edge Function fires on object-created
 * regardless of whether the upload used a signed URL or direct auth.
 */

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient, getCurrentTenantId } from '@/lib/supabase/server';

export interface EnsureMeetingChannelArgs {
  meeting_slug: string;
  display_name?: string;
  location?: string;
}

export interface EnsureMeetingChannelResult {
  ok: boolean;
  error?: string;
  tenant_slug?: string;
  meeting_slug?: string;
  channel_id?: string;
  upload_prefix?: string;            // e.g. 'viter/meetings/ahiya-2026-05-05/'
}

export interface GetSignedUploadUrlResult {
  ok: boolean;
  error?: string;
  signed_url?: string;
  path?: string;
  token?: string;
}

const SLUG_RX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export async function ensureMeetingChannel(args: EnsureMeetingChannelArgs): Promise<EnsureMeetingChannelResult> {
  const meetingSlug = args.meeting_slug.trim().toLowerCase();
  if (!meetingSlug || !SLUG_RX.test(meetingSlug)) {
    return { ok: false, error: 'slug must be lowercase letters, digits, and hyphens (no leading/trailing hyphen)' };
  }
  if (meetingSlug.length > 80) {
    return { ok: false, error: 'slug must be ≤ 80 characters' };
  }

  const db = getServiceRoleClient();
  const tenantId = await getCurrentTenantId();

  const { data: tenantRow } = await db.from('tenants').select('slug').eq('id', tenantId).single();
  const tenantSlug = (tenantRow?.slug as string) ?? 'viter';

  const metadata: Record<string, unknown> = {
    ingest_source: 'inbox-webhook',
    created_via: 'apps/web/meetings',
  };
  if (args.location) metadata.location = args.location;

  const { data: ch, error: chErr } = await db
    .from('channels')
    .upsert(
      {
        tenant_id: tenantId,
        kind: 'meeting',
        identifier: meetingSlug,
        scope: 'tenant',
        display_name: args.display_name?.trim() || `meeting: ${meetingSlug}`,
        metadata,
      },
      { onConflict: 'tenant_id,kind,identifier' },
    )
    .select('id')
    .single();

  if (chErr || !ch) {
    return { ok: false, error: `channel upsert: ${chErr?.message ?? 'unknown error'}` };
  }

  revalidatePath('/meetings');

  return {
    ok: true,
    tenant_slug: tenantSlug,
    meeting_slug: meetingSlug,
    channel_id: ch.id as string,
    upload_prefix: `${tenantSlug}/meetings/${meetingSlug}/`,
  };
}

/**
 * Generate a signed upload URL for one file. Called per-file by the dropzone
 * so the browser can PUT bytes directly to Supabase Storage without needing
 * its own auth session — the service-role key on the server signs the URL.
 */
export async function getSignedUploadUrl(
  uploadPrefix: string,
  filename: string,
): Promise<GetSignedUploadUrlResult> {
  if (!uploadPrefix || !filename) return { ok: false, error: 'prefix and filename required' };

  const db = getServiceRoleClient();
  const path = `${uploadPrefix}${filename}`;

  const { data, error } = await db.storage
    .from('inbox')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'failed to create signed URL' };
  }

  return {
    ok: true,
    signed_url: data.signedUrl,
    path: data.path,
    token: data.token,
  };
}

/** Generate a default slug from today's date — used as the form's initial value. */
export async function suggestMeetingSlug(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  return `meeting-${yyyy}-${mm}-${dd}-${hh}00`;
}
