'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient, getCurrentTenantId } from '@/lib/supabase/server';

/**
 * Save speaker name assignments for a meeting channel.
 * speakers: { A: 'Mordechai', B: 'Shaul' }
 */
export async function saveSpeakerNames(
  channelId: string,
  speakers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const tenantId = await getCurrentTenantId();
  const db = getServiceRoleClient();

  // Build the updated speakers map — preserve existing cues/confidence, just update name
  const { data: channel } = await db
    .from('channels')
    .select('metadata')
    .eq('id', channelId)
    .eq('tenant_id', tenantId)
    .single();
  if (!channel) return { ok: false, error: 'channel not found' };

  const existingSpeakers = ((channel.metadata as Record<string, unknown>)?.speakers ?? {}) as
    Record<string, Record<string, unknown>>;

  const updatedSpeakers: Record<string, unknown> = {};
  for (const [code, name] of Object.entries(speakers)) {
    if (!name.trim()) continue;
    updatedSpeakers[code] = {
      ...(existingSpeakers[code] ?? {}),
      name: name.trim(),
    };
  }

  const { error } = await db
    .from('channels')
    .update({ metadata: { ...(channel.metadata as Record<string, unknown>), speakers: updatedSpeakers } })
    .eq('id', channelId)
    .eq('tenant_id', tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/chat/${channelId}`);
  return { ok: true };
}

/**
 * Auto-detect speaker names using Claude via OpenRouter.
 * Samples the first 8 utterances per speaker and asks Claude to identify them
 * given the known Vita participants.
 */
export async function detectSpeakers(
  channelId: string,
): Promise<{ ok: boolean; speakers?: Record<string, { name: string; confidence: number }>; error?: string }> {
  const tenantId = await getCurrentTenantId();
  const db = getServiceRoleClient();

  // Pull first 8 utterances per speaker
  const { data: events } = await db
    .from('l1_events')
    .select('metadata, content')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .eq('facet', 'transcription')
    .not('metadata->>speaker', 'is', null)
    .order('ts_start_s', { ascending: true })
    .limit(200);

  if (!events || events.length === 0) return { ok: false, error: 'no labelled utterances found' };

  // Group by speaker, keep first 8 per speaker
  const bySpeaker: Record<string, string[]> = {};
  for (const e of events) {
    const spk = (e.metadata as Record<string, unknown>)?.speaker as string | null;
    if (!spk || !e.content) continue;
    if (!bySpeaker[spk]) bySpeaker[spk] = [];
    if (bySpeaker[spk]!.length < 8) bySpeaker[spk]!.push(e.content.trim().slice(0, 200));
  }

  const speakerCodes = Object.keys(bySpeaker).sort();
  if (speakerCodes.length === 0) return { ok: false, error: 'no speakers detected' };

  const samplesBlock = speakerCodes.map((code) => {
    const lines = (bySpeaker[code] ?? []).map((t, i) => `  [${i + 1}] ${t}`).join('\n');
    return `Speaker ${code}:\n${lines}`;
  }).join('\n\n');

  const prompt = `You are identifying speakers in a meeting transcript.

Known participants in the Vita project:
- Mordechai Potash: architect/engineer, explains L0-L3 pipeline, HPI protocol, WhatsApp connectors, monotropic deep focus, long monologues
- Shaul Levine: founder/strategy, pulls up Palantir docs, asks how things connect to the platform, listens then asks practical questions
- Yitzhak Brown: frontend/infra, building genUI, asks about Supabase schema, data connections, uses Claude (not Claude Code)
- Jeffrey Levine: CFO domain, patent prosecution, financial workflows

Here are sample utterances for each speaker label:

${samplesBlock}

For each speaker label, return a JSON object like:
{ "A": { "name": "Mordechai", "confidence": 0.97 }, "B": { "name": "Shaul", "confidence": 0.90 } }

Only include speakers you saw samples for. Confidence 0.95+ = unmistakable, 0.7 = plausible, 0.5 = guess.
Return ONLY the JSON object, no other text.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENROUTER_API_KEY not set' };

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vita.viter.ai',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0,
    }),
  });

  if (!res.ok) return { ok: false, error: `OpenRouter ${res.status}` };
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON');
    const parsed = JSON.parse(m[0]) as Record<string, { name: string; confidence: number }>;
    return { ok: true, speakers: parsed };
  } catch {
    return { ok: false, error: `could not parse response: ${text.slice(0, 100)}` };
  }
}

