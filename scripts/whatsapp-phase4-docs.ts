/**
 * scripts/whatsapp-phase4-docs.ts
 *
 * Phase 4 of WhatsApp ingest — extract text from document attachments.
 *
 * Dispatch by mime/extension:
 *   PDF   → gemini-2.5-flash-lite via OpenRouter chat completions
 *           (base64 file_data input, returns full text + page chunks)
 *   DOCX  → mammoth.extractRawText (local, free, deterministic)
 *   XLSX  → xlsx (sheetjs) sheet_to_csv per sheet (local)
 *   HTML  → strip tags (local)
 *   MD    → identity
 *   JSON  → pretty-print
 *   ZIP   → skip (not text content)
 *
 * For each doc:
 *   1. Skip if l1_extraction_run(facet='doc_text', status='ok') already exists.
 *   2. Download bytes from bucket.
 *   3. Extract text via the appropriate handler.
 *   4. Insert l1_extraction_run.
 *   5. Insert l1_event (modality='file', content=full_text, inherits actor + event_at).
 *   6. For PDFs with > 1 page, also write l1_doc_chunks (one per page).
 *   7. Promote run as active extraction.
 *
 * Idempotent. Use --limit N for smoke tests.
 *
 * Usage:
 *   tsx scripts/whatsapp-phase4-docs.ts --tenant viter --chat shaul-direct --limit 3
 *   tsx scripts/whatsapp-phase4-docs.ts --tenant viter --chat shaul-direct
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENROUTER_API_KEY
 *      VITER_DOC_MODEL (optional, default 'google/gemini-2.5-flash-lite')
 */

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

import { createServiceRoleClient } from '../packages/runtime/src/db.js';

interface Args {
  tenant: string;
  chat: string;
  limit: number;
  model: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    tenant: '',
    chat: '',
    limit: 0,
    model: process.env.VITER_DOC_MODEL ?? 'google/gemini-2.5-flash-lite',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant') out.tenant = argv[++i] ?? '';
    else if (a === '--chat') out.chat = argv[++i] ?? '';
    else if (a === '--limit') out.limit = Number(argv[++i] ?? '0') || 0;
    else if (a === '--model') out.model = argv[++i] ?? out.model;
  }
  if (!out.tenant || !out.chat) {
    console.error('Usage: tsx scripts/whatsapp-phase4-docs.ts --tenant <slug> --chat <slug> [--limit N] [--model <slug>]');
    process.exit(2);
  }
  return out;
}

interface ExtractResult {
  text: string;
  extractor: string;
  metrics: Record<string, unknown>;
  // Optional per-page chunks for PDFs (best-effort)
  chunks?: Array<{ chunk_no: number; content: string; page?: number }>;
}

// ── Local extractors ─────────────────────────────────────────────────

async function extractDocx(buf: Buffer): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer: buf });
  return {
    text: result.value,
    extractor: 'mammoth-extractRawText',
    metrics: {
      chars: result.value.length,
      messages: result.messages.length,
    },
  };
}

function extractXlsx(buf: Buffer): ExtractResult {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const parts: string[] = [];
  let totalRows = 0;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]!;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`### Sheet: ${name}\n\n${csv}`);
    totalRows += csv.split('\n').length;
  }
  const text = parts.join('\n\n---\n\n');
  return {
    text,
    extractor: 'sheetjs-sheet_to_csv',
    metrics: { chars: text.length, sheets: wb.SheetNames.length, total_rows: totalRows },
  };
}

function extractHtml(buf: Buffer): ExtractResult {
  const html = buf.toString('utf-8');
  // Strip <script>/<style> blocks, then all remaining tags, decode common entities.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    text: stripped,
    extractor: 'regex-strip-html',
    metrics: { chars: stripped.length, raw_chars: html.length },
  };
}

function extractText(buf: Buffer, extractor: string): ExtractResult {
  const text = buf.toString('utf-8');
  return { text, extractor, metrics: { chars: text.length } };
}

function extractJson(buf: Buffer): ExtractResult {
  const raw = buf.toString('utf-8');
  try {
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    return { text: pretty, extractor: 'json-pretty', metrics: { chars: pretty.length, valid: true } };
  } catch {
    return { text: raw, extractor: 'json-raw', metrics: { chars: raw.length, valid: false } };
  }
}

// ── PDF via OpenRouter / Gemini ──────────────────────────────────────

interface OpenRouterPdfResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string } | string;
}

async function extractPdfViaGemini(
  buf: Buffer,
  filename: string,
  apiKey: string,
  model: string,
): Promise<ExtractResult> {
  const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
  // Sanitize filename for OpenRouter's parser (no spaces/parens)
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vita.viter.ai',
      'X-Title': 'vita whatsapp ingest phase4',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Extract all text from this PDF verbatim, preserving structure (headings, lists, tables as markdown tables when possible). ' +
                'Output ONLY the extracted text. Use page separators of the form `\\n\\n--- page N ---\\n\\n` between pages.',
            },
            {
              type: 'file',
              file: { filename: safeName, file_data: dataUrl },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openrouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as OpenRouterPdfResponse;
  if (data.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error.message ?? data.error.code;
    throw new Error(`openrouter error: ${msg}`);
  }
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('empty extraction');

  // Best-effort split on page markers
  const chunks: ExtractResult['chunks'] = [];
  const pageRe = /\n\n---\s*page\s*(\d+)\s*---\n\n/gi;
  if (pageRe.test(text)) {
    pageRe.lastIndex = 0;
    const parts = text.split(pageRe);
    // parts: [pre, page1, content1, page2, content2, ...] OR [content1, page2, content2, ...]
    let chunkNo = 0;
    if (parts[0]?.trim()) {
      chunks.push({ chunk_no: chunkNo++, content: parts[0]!.trim(), page: 1 });
    }
    for (let i = 1; i < parts.length; i += 2) {
      const pg = Number(parts[i]);
      const content = parts[i + 1]?.trim();
      if (content) chunks.push({ chunk_no: chunkNo++, content, page: pg });
    }
  }

  return {
    text,
    extractor: model,
    metrics: {
      chars: text.length,
      n_pages_detected: chunks.length || 1,
      generation_id: data.id,
      model_used: data.model,
      provider: data.provider,
      usage: data.usage,
    },
    chunks: chunks.length > 1 ? chunks : undefined,
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────

async function dispatchExtract(
  buf: Buffer,
  filename: string,
  mime: string,
  apiKey: string,
  model: string,
): Promise<ExtractResult | null> {
  const lower = filename.toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return extractPdfViaGemini(buf, filename, apiKey, model);
  }
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
    return extractDocx(buf);
  }
  if (lower.endsWith('.xlsx') || mime.includes('spreadsheetml')) {
    return extractXlsx(buf);
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm') || mime.startsWith('text/html')) {
    return extractHtml(buf);
  }
  if (lower.endsWith('.md') || mime === 'text/markdown') {
    return extractText(buf, 'markdown-identity');
  }
  if (lower.endsWith('.json') || mime === 'application/json') {
    return extractJson(buf);
  }
  if (lower.endsWith('.txt') || mime.startsWith('text/')) {
    return extractText(buf, 'plain-text-identity');
  }
  // skip zip, binary, etc
  return null;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY required');

  console.log(`[phase4] tenant=${args.tenant} · chat=${args.chat} · pdf-model=${args.model}` + (args.limit ? ` · limit=${args.limit}` : ''));

  const db = createServiceRoleClient();
  const { data: tenantRow } = await db.from('tenants').select('id').eq('slug', args.tenant).single();
  if (!tenantRow) throw new Error(`tenant '${args.tenant}' not found`);
  const tenantId = tenantRow.id as string;

  const { data: channelRow } = await db
    .from('channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('kind', 'whatsapp')
    .eq('identifier', args.chat)
    .single();
  if (!channelRow) throw new Error(`channel 'whatsapp:${args.chat}' not found`);
  const channelId = channelRow.id as string;

  // 1. Find non-audio/image/video attachments
  const { data: docs } = await db
    .from('l0_artifacts')
    .select('id, source_uri, metadata, bytes, origin_at')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'whatsapp_attachment')
    .eq('metadata->>chat_slug', args.chat)
    .order('origin_at', { ascending: true });
  if (!docs) {
    console.log('[phase4] no documents');
    return;
  }

  const targets = docs.filter((d) => {
    const k = (d.metadata as { kind: string }).kind;
    return !['audio', 'image', 'video', 'zip'].includes(k);
  });
  console.log(`[phase4] ${targets.length} document attachments (skipping zip/audio/image/video)`);

  // 2. Skip already-extracted
  const ids = targets.map((d) => d.id as string);
  const done = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: runs } = await db
      .from('l1_extraction_runs')
      .select('artifact_id')
      .eq('tenant_id', tenantId)
      .eq('facet', 'doc_text')
      .eq('status', 'ok')
      .in('artifact_id', ids.slice(i, i + 200));
    for (const r of runs ?? []) done.add(r.artifact_id as string);
  }
  console.log(`[phase4] ${done.size} already extracted; ${targets.length - done.size} new`);

  // 3. Build filename → originating-message actor_id (and event_at) map
  const filenameToActor = new Map<string, string | null>();
  const filenameToEventAt = new Map<string, string>();
  {
    const { data: msgEvents } = await db
      .from('l1_events')
      .select('actor_id, event_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('channel_id', channelId)
      .eq('facet', 'messages');
    for (const e of msgEvents ?? []) {
      const md = e.metadata as { attachment_filenames?: string[] };
      for (const fn of md.attachment_filenames ?? []) {
        filenameToActor.set(fn, e.actor_id as string | null);
        filenameToEventAt.set(fn, e.event_at as string);
      }
    }
  }

  // 4. Process
  let nDone = 0;
  let nSkipped = 0;
  let nErr = 0;
  const remoteBase = `${args.tenant}/${args.chat}`;
  const pending = targets.filter((a) => !done.has(a.id as string));
  const target = args.limit > 0 ? Math.min(pending.length, args.limit) : pending.length;

  for (let i = 0; i < target; i++) {
    const a = pending[i]!;
    const md = a.metadata as { filename: string; mime_type: string; kind: string };
    const filename = md.filename;
    const remotePath = `${remoteBase}/${filename}`;
    const sizeKB = ((a.bytes as number) / 1024).toFixed(1);
    const attempt = i + 1;
    process.stdout.write(`  [${attempt.toString().padStart(2)}/${target}] ${filename.slice(0, 60).padEnd(60)} (${sizeKB}K, ${md.kind}) … `);

    const t0 = Date.now();
    try {
      const { data: blob, error: dErr } = await db.storage.from('l0-whatsapp').download(remotePath);
      if (dErr || !blob) throw new Error(`download: ${dErr?.message}`);
      const buf = Buffer.from(await blob.arrayBuffer());

      const r = await dispatchExtract(buf, filename, md.mime_type, apiKey, args.model);
      if (!r) {
        nSkipped++;
        console.log('⌥ skipped (unsupported)');
        continue;
      }

      const wallMs = Date.now() - t0;
      const isLLM = r.extractor === args.model;

      const { data: runIns, error: runErr } = await db
        .from('l1_extraction_runs')
        .insert({
          tenant_id: tenantId,
          artifact_id: a.id,
          facet: 'doc_text',
          extractor: r.extractor,
          version: '2026-05-04',
          parameters: { source_mime: md.mime_type, source_kind: md.kind },
          is_deterministic: !isLLM,
          status: 'ok',
          started_at: new Date(t0).toISOString(),
          completed_at: new Date().toISOString(),
          metrics: { wall_ms: wallMs, ...r.metrics },
        })
        .select('id')
        .single();
      if (runErr || !runIns) throw new Error(`run insert: ${runErr?.message}`);
      const runId = runIns.id as string;

      const actorId = filenameToActor.get(filename) ?? null;
      const eventAt = filenameToEventAt.get(filename) ?? (a.origin_at as string);

      // Insert event (full text)
      const { error: evErr } = await db.from('l1_events').insert({
        tenant_id: tenantId,
        artifact_id: a.id,
        extraction_run_id: runId,
        facet: 'doc_text',
        event_at: eventAt,
        position: 0,
        actor_id: actorId,
        channel_id: channelId,
        modality: 'file',
        content: r.text,
        confidence: null,
        extraction_method: `${r.extractor}@2026-05-04`,
        metadata: {
          filename,
          mime_type: md.mime_type,
          kind: md.kind,
          chars: r.text.length,
          n_chunks: r.chunks?.length ?? 0,
        },
      });
      if (evErr) throw new Error(`event insert: ${evErr.message}`);

      // Per-page chunks (PDFs only)
      if (r.chunks && r.chunks.length > 0) {
        const chunkRows = r.chunks.map((c) => ({
          tenant_id: tenantId,
          artifact_id: a.id,
          extraction_run_id: runId,
          chunk_no: c.chunk_no,
          content: c.content,
          page: c.page ?? null,
          metadata: { filename },
        }));
        const { error: chErr } = await db.from('l1_doc_chunks').insert(chunkRows);
        if (chErr) console.error(`     chunks insert failed: ${chErr.message}`);
      }

      // Promote
      await db.from('l1_active_extraction').upsert({
        tenant_id: tenantId,
        artifact_id: a.id,
        facet: 'doc_text',
        active_run_id: runId,
        promoted_by: 'auto',
        reason: 'first-extract',
      });

      nDone++;
      const preview = r.text.replace(/\s+/g, ' ').slice(0, 60);
      console.log(`✓ ${(wallMs / 1000).toFixed(1)}s  ${r.text.length}c  via ${r.extractor.slice(0, 18)}  "${preview}"`);
    } catch (err) {
      nErr++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${msg}`);
    }
  }

  console.log('');
  console.log(`[phase4] DONE`);
  console.log(`  documents:           ${targets.length}`);
  console.log(`  already extracted:   ${done.size}`);
  console.log(`  newly extracted:     ${nDone}`);
  console.log(`  skipped (unsupp):    ${nSkipped}`);
  console.log(`  errors:              ${nErr}`);
}

main().catch((err) => {
  console.error('[phase4] fatal:', err);
  process.exit(1);
});
