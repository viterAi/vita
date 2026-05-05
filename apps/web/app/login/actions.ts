'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthClient } from '@/lib/supabase/server-auth';

export interface MagicLinkResult {
  ok: boolean;
  error?: string;
  email?: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/** Send a magic link to the supplied email. Allowlist enforced server-side. */
export async function sendMagicLink(email: string, next?: string): Promise<MagicLinkResult> {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !cleaned.includes('@')) return { ok: false, error: 'enter a valid email' };

  const allowlist = (process.env.AUTH_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(cleaned)) {
    // Don't tell the bot whether the email is or isn't on the list — same
    // generic confirmation either way to avoid email enumeration. Real
    // unallowlisted attempts just don't get a link.
    return { ok: true, email: cleaned };
  }

  const sb = await getAuthClient();
  const reqHeaders = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${reqHeaders.get('host') ?? 'localhost:3000'}`;
  const redirectTo = `${origin.replace(/\/$/, '')}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  const { error } = await sb.auth.signInWithOtp({
    email: cleaned,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, email: cleaned };
}

/**
 * Verify the 6-digit code from the email. This bypasses the magic-link
 * Gmail-prefetch problem (Gmail's anti-phishing scanner fetches the URL
 * before the user clicks, burning the OTP). The same email contains both
 * the link AND the 6-digit code; the code is single-use but only on
 * server-side submission.
 */
export async function verifyEmailCode(email: string, token: string, next?: string): Promise<VerifyResult> {
  const cleanedEmail = email.trim().toLowerCase();
  const cleanedToken = token.replace(/\D/g, '');
  if (!cleanedEmail || !cleanedToken) return { ok: false, error: 'email + code required' };
  if (cleanedToken.length !== 6) return { ok: false, error: 'enter the 6-digit code' };

  const sb = await getAuthClient();
  const { error } = await sb.auth.verifyOtp({
    email: cleanedEmail,
    token: cleanedToken,
    type: 'email',
  });
  if (error) return { ok: false, error: error.message };

  redirect(next && next.startsWith('/') ? next : '/');
}
