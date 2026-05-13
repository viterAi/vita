/**
 * Encode a composite source id for `/api/sources/[sourceId]/…`.
 * Uses base64url so GitHub keys (`github:owner/repo`) never put `/` in the URL —
 * Vercel/Next decode `%2F` back to `/` before route matching, which breaks `[sourceId]`.
 *
 * Intentionally avoids `Buffer.toString("base64url")`: Next's browser bundle polyfills
 * `Buffer` without that encoding and would throw at runtime.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(segment: string): Uint8Array {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const binary = atob(b64 + "=".repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function sourceIdPathSegment(sourceId: string): string {
  return bytesToBase64Url(new TextEncoder().encode(sourceId));
}

export function decodeSourceIdPathSegment(segment: string): string {
  try {
    return new TextDecoder().decode(base64UrlToBytes(segment));
  } catch {
    return decodeURIComponent(segment);
  }
}
