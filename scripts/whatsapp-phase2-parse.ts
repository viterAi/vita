/**
 * scripts/whatsapp-phase2-parse.ts
 *
 * Phase 2 of WhatsApp ingest — parse _chat.txt into messages + events.
 *
 * Reads `l0-whatsapp/<tenant>/<chat>/_chat.txt` from Supabase Storage,
 * splits it into messages (matching the same regex Python ingest.py uses),
 * resolves senders → principals, attachments → existing l0_artifact ids,
 * and writes:
 *
 *   l0_artifacts        one per message (source_type='whatsapp_message')
 *   l1_extraction_runs  one per message-artifact (facet='messages',
 *                       extractor='whatsapp-text-parser', version='v1',
 *                       is_deterministic=true)
 *   l1_events           one per message (modality derived from attachments)
 *
 * Idempotent: messages keyed by sha256(ts_raw|sender|body); re-runs are no-ops.
 *
 * Usage:
 *   tsx scripts/whatsapp-phase2-parse.ts --tenant viter --chat shaul-direct
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createHash } from 'node:crypto';

import { createServiceRoleClient } from '../packages/runtime/src/db.js';

interface Args {
  tenant: string;
  chat: string;
}

interface ParsedMessage {
  ts_raw: string;          // "14/04/2026, 21:50:34"
  ts_iso: string;          // "2026-04-14T21:50:34+03:00"
  sender_raw: string;
  body: string;
  attachments: string[];   // filenames referenced via <attached: ...>
  line_no: number;         // 1-based, points to header line
}

const HEADER_RE =
  /^‎?\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\]\s+([^:]+?):\s?(.*)$/;
const ATTACHED_RE = /‎?<attached:\s*([^>]+)>/g;

const ENCRYPTION_NOTICE = 'Messages and calls are end-to-end encrypted';

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant') out.tenant = argv[++i];
    else if (a === '--chat') out.chat = argv[++i];
  }
  if (!out.tenant || !out.chat) {
    console.error('Usage: tsx scripts/whatsapp-phase2-parse.ts --tenant <slug> --chat <slug>');
    process.exit(2);
  }
  return out as Args;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function parseChatTxt(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const m = HEADER_RE.exec(raw);
    if (m) {
      if (current) messages.push(current);
      const [, dd, mm, yyyy, hh, mi, ss, sender, body] = m;

      // Skip the encryption-notice system line
      if (body!.includes(ENCRYPTION_NOTICE)) {
        current = null;
        continue;
      }

      const ts_raw = `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`;
      // Israel local time → ISO with +03:00 (matches Python ingest.py)
      const ts_iso = `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}T${hh!.padStart(2, '0')}:${mi}:${ss}+03:00`;

      const attachments = [...body!.matchAll(ATTACHED_RE)].map((mm2) => mm2[1]!.trim());

      current = {
        ts_raw,
        ts_iso,
        sender_raw: sender!.trim(),
        body: body!.trim(),
        attachments,
        line_no: i + 1,
      };
    } else if (current && raw.trim()) {
      // continuation line — append to current body, re-scan attachments
      current.body = current.body + '\n' + raw;
      current.attachments = [...current.body.matchAll(ATTACHED_RE)].map((mm2) => mm2[1]!.trim());
    }
  }
  if (current) messages.push(current);
  return messages;
}

function msgHash(ts_raw: string, sender: string, body: string): string {
  return sha256Hex(`${ts_raw}|${sender}|${body}`);
}

function deriveModality(attachments: string[], body: string): string {
  if (attachments.length === 0) {
    // body-only meta events ("Voice call, Answered on other device" etc.)
    if (/voice call|missed.*call|this message was deleted/i.test(body)) return 'signal';
    return 'text';
  }
  const a0 = attachments[0]!.toLowerCase();
  if (/\.(opus|m4a|mp3|wav)$/.test(a0)) return 'voice';
  if (/\.(jpe?g|png|webp|gif)$/.test(a0)) return 'image';
  if (/\.(mp4|mov)$/.test(a0)) return 'video';
  if (/\.(pdf|docx?|xlsx?|zip|json|html)$/.test(a0)) return 'file';
  return 'file';
}

function classifyKind(body: string, attachments: string[]): string {
  if (attachments.length > 0) return 'attachment';
  if (/^‎?Missed voice call/i.test(body) || /Voice call/i.test(body)) return 'call_event';
  if (/^‎?This message was deleted/i.test(body)) return 'deleted';
  return 'text';
}

async function main() {
  const args = parseArgs(process.argv);
  const db = createServiceRoleClient();

  // 1. Resolve tenant + channel
  const { data: tenantRow, error: tErr } = await db
    .from('tenants')
    .select('id')
    .eq('slug', args.tenant)
    .single();
  if (tErr || !tenantRow) throw new Error(`tenant '${args.tenant}' not found`);
  const tenantId = tenantRow.id as string;

  const { data: channelRow, error: cErr } = await db
    .from('channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('kind', 'whatsapp')
    .eq('identifier', args.chat)
    .single();
  if (cErr || !channelRow) throw new Error(`channel 'whatsapp:${args.chat}' not found`);
  const channelId = channelRow.id as string;

  // 2. Build sender → principal_id map
  const { data: principals } = await db
    .from('principals')
    .select('id, canonical_id, display_name, identifiers, metadata')
    .eq('tenant_id', tenantId);
  if (!principals) throw new Error('no principals');

  const senderToPrincipal = new Map<string, string>();
  for (const p of principals) {
    const key1 = (p.display_name as string).toLowerCase();
    const key2 = (p.canonical_id as string).toLowerCase();
    senderToPrincipal.set(key1, p.id as string);
    senderToPrincipal.set(key2, p.id as string);
    // Also index first-name (so "mordechai" → mordechai-potash, "Shaul" → shaul-levine)
    const first = (p.display_name as string).split(/\s+/)[0]!.toLowerCase();
    if (!senderToPrincipal.has(first)) senderToPrincipal.set(first, p.id as string);
  }

  function resolveSender(senderRaw: string): string | null {
    const lower = senderRaw.toLowerCase().trim();
    return senderToPrincipal.get(lower)
      ?? senderToPrincipal.get(lower.split(/\s+/)[0]!)
      ?? null;
  }

  // 3. Download _chat.txt from bucket
  const remotePath = `${args.tenant}/${args.chat}/_chat.txt`;
  console.log(`[phase2] downloading l0-whatsapp/${remotePath}`);
  const { data: blob, error: dErr } = await db.storage.from('l0-whatsapp').download(remotePath);
  if (dErr || !blob) throw new Error(`failed to download _chat.txt: ${dErr?.message}`);
  const chatText = await blob.text();

  // 4. Parse
  const messages = parseChatTxt(chatText);
  console.log(`[phase2] parsed ${messages.length} messages`);

  // 5. Build attachment-filename → l0_artifact.id map (existing whatsapp_attachment rows for this chat)
  const { data: attachmentRows } = await db
    .from('l0_artifacts')
    .select('id, metadata')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'whatsapp_attachment')
    .eq('metadata->>chat_slug', args.chat);

  const filenameToArtifactId = new Map<string, string>();
  for (const r of attachmentRows ?? []) {
    const fn = (r.metadata as { filename?: string })?.filename;
    if (fn) filenameToArtifactId.set(fn, r.id as string);
  }
  console.log(`[phase2] ${filenameToArtifactId.size} known attachments to link`);

  // 6. Pre-compute hashes; bulk-fetch existing l0_artifacts to skip already-processed
  const decorated = messages.map((m) => ({
    ...m,
    hash: msgHash(m.ts_raw, m.sender_raw, m.body),
  }));

  const allHashes = decorated.map((m) => m.hash);
  const existing = new Set<string>();
  // Supabase has no IN-with-1000+ limit normally but keep batches small
  for (let i = 0; i < allHashes.length; i += 200) {
    const batch = allHashes.slice(i, i + 200);
    const { data } = await db
      .from('l0_artifacts')
      .select('sha256')
      .eq('tenant_id', tenantId)
      .in('sha256', batch);
    for (const row of data ?? []) existing.add(row.sha256 as string);
  }
  console.log(`[phase2] ${existing.size} of ${decorated.length} messages already in l0; ${decorated.length - existing.size} new`);

  // 7. Per message: insert l0 artifact, extraction run, event
  let nL0 = 0;
  let nRuns = 0;
  let nEvents = 0;
  let nUnresolvedSender = 0;
  let nErrors = 0;
  let progressEvery = 50;

  for (let idx = 0; idx < decorated.length; idx++) {
    const m = decorated[idx]!;
    if (existing.has(m.hash)) continue;

    const actorId = resolveSender(m.sender_raw);
    if (!actorId) nUnresolvedSender++;

    const kind = classifyKind(m.body, m.attachments);
    const modality = deriveModality(m.attachments, m.body);

    // 7a. Insert l0_artifact (whatsapp_message)
    const sourceUri = `l0-whatsapp/${remotePath}#L${m.line_no}`;

    const { data: l0Inserted, error: l0Err } = await db
      .from('l0_artifacts')
      .insert({
        tenant_id: tenantId,
        source_type: 'whatsapp_message',
        source_uri: sourceUri,
        sha256: m.hash,
        bytes: Buffer.byteLength(m.body, 'utf8'),
        origin_at: m.ts_iso,
        inline_text: m.body,
        metadata: {
          chat_slug: args.chat,
          tenant_slug: args.tenant,
          sender_raw: m.sender_raw,
          ts_raw: m.ts_raw,
          line_no: m.line_no,
          kind,
          attachment_filenames: m.attachments,
        },
      })
      .select('id')
      .single();

    if (l0Err || !l0Inserted) {
      nErrors++;
      console.error(`  ✗ l0 insert ${m.ts_raw} ${m.sender_raw}: ${l0Err?.message}`);
      continue;
    }
    const artifactId = l0Inserted.id as string;
    nL0++;

    // 7b. Insert l1_extraction_run (deterministic parser)
    const { data: runInserted, error: runErr } = await db
      .from('l1_extraction_runs')
      .insert({
        tenant_id: tenantId,
        artifact_id: artifactId,
        facet: 'messages',
        extractor: 'whatsapp-text-parser',
        version: 'v1',
        parameters: {},
        is_deterministic: true,
        status: 'ok',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metrics: { n_events: 1 },
      })
      .select('id')
      .single();

    if (runErr || !runInserted) {
      nErrors++;
      console.error(`  ✗ run insert ${m.ts_raw}: ${runErr?.message}`);
      continue;
    }
    const runId = runInserted.id as string;
    nRuns++;

    // 7c. Resolve attachment artifact ids for metadata
    const attachmentArtifactIds = m.attachments
      .map((fn) => filenameToArtifactId.get(fn))
      .filter((x): x is string => Boolean(x));

    // 7d. Insert l1_event
    const { error: evErr } = await db.from('l1_events').insert({
      tenant_id: tenantId,
      artifact_id: artifactId,
      extraction_run_id: runId,
      facet: 'messages',
      event_at: m.ts_iso,
      position: 0,
      actor_id: actorId,
      channel_id: channelId,
      modality,
      content: m.body,
      line_no: m.line_no,
      confidence: 1.0,
      extraction_method: 'whatsapp-text-parser@v1',
      metadata: {
        sender_raw: m.sender_raw,
        kind,
        attachment_filenames: m.attachments,
        attachment_artifact_ids: attachmentArtifactIds,
        unresolved_attachments: m.attachments.length - attachmentArtifactIds.length,
      },
    });

    if (evErr) {
      nErrors++;
      console.error(`  ✗ event insert ${m.ts_raw}: ${evErr.message}`);
      continue;
    }
    nEvents++;

    if (nEvents % progressEvery === 0) {
      console.log(`  … ${nEvents} events inserted`);
    }
  }

  console.log('');
  console.log(`[phase2] DONE`);
  console.log(`  parsed messages:        ${decorated.length}`);
  console.log(`  already in l0:          ${existing.size}`);
  console.log(`  l0_artifacts new:       ${nL0}`);
  console.log(`  extraction_runs new:    ${nRuns}`);
  console.log(`  l1_events new:          ${nEvents}`);
  console.log(`  unresolved senders:     ${nUnresolvedSender}`);
  console.log(`  errors:                 ${nErrors}`);

  // 8. Spot summary — first + last 3 events for visual sanity
  const { data: sample } = await db
    .from('l1_events')
    .select('event_at, modality, actor_id, content')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .order('event_at', { ascending: true })
    .limit(3);
  if (sample && sample.length) {
    console.log('\n[phase2] earliest events:');
    for (const r of sample) {
      const txt = (r.content ?? '').replace(/\n/g, ' ').slice(0, 80);
      console.log(`  ${r.event_at}  [${r.modality}]  ${txt}`);
    }
  }
}

main().catch((err) => {
  console.error('[phase2] fatal:', err);
  process.exit(1);
});
