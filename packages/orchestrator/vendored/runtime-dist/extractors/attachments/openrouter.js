/**
 * Shared OpenRouter helpers for the LLM-routed attachment extractors.
 *
 * One key, three endpoints:
 *   - /v1/audio/transcriptions   (whisper-class models, JSON body w/ input_audio)
 *   - /v1/chat/completions       (multimodal models — gemini family for PDF/image)
 */
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const COMMON_HEADERS = {
    'HTTP-Referer': 'https://vita.viter.ai',
    'X-OpenRouter-Title': 'vita extract-attachment',
};
function stripUndef(o) {
    const out = {};
    for (const k of Object.keys(o))
        if (o[k] !== undefined && o[k] !== null)
            out[k] = o[k];
    return out;
}
export async function postTranscription(args) {
    const body = {
        model: args.model,
        input_audio: { data: args.audioB64, format: args.format },
        response_format: 'verbose_json',
    };
    if (args.prompt)
        body.prompt = args.prompt;
    if (args.language)
        body.language = args.language;
    if (args.callerMetadata)
        body.metadata = stripUndef(args.callerMetadata);
    const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${args.apiKey}`,
            'Content-Type': 'application/json',
            ...COMMON_HEADERS,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json());
    if (data.error) {
        const m = typeof data.error === 'string' ? data.error : data.error.message ?? data.error.code;
        throw new Error(`openrouter error: ${m}`);
    }
    return data;
}
export async function postChatCompletion(args) {
    const fullBody = { model: args.model, ...args.body };
    if (args.callerMetadata)
        fullBody.metadata = stripUndef(args.callerMetadata);
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${args.apiKey}`,
            'Content-Type': 'application/json',
            ...COMMON_HEADERS,
        },
        body: JSON.stringify(fullBody),
    });
    if (!res.ok)
        throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json());
    if (data.error) {
        const m = typeof data.error === 'string' ? data.error : data.error.message ?? data.error.code;
        throw new Error(`openrouter error: ${m}`);
    }
    return data;
}
//# sourceMappingURL=openrouter.js.map