/**
 * /login — request a 6-digit code (with magic-link fallback).
 *
 * Email-only. No password. Allowlist enforced server-side; same generic
 * "check your email" message either way so we don't leak membership.
 *
 * Why OTP code instead of magic-link click? Gmail's anti-phishing scanner
 * silently fetches every link in incoming email, which consumes the
 * single-use OTP before the user clicks. Codes don't have that problem.
 */

import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    err?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialError = sp.error_description
    ? humanizeAuthError(sp.error_description, sp.error)
    : sp.err;

  return (
    <div className="flex min-h-dvh flex-col bg-stone-100 dark:bg-zinc-950">
      <header className="flex h-12 items-center bg-emerald-700 px-4 text-emerald-50">
        <Link href="/" className="text-sm font-semibold tracking-tight hover:text-white">
          vita
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Sign in to vita
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email — we&apos;ll send you a 6-digit code.
          </p>
          <LoginForm next={sp.next} initialError={initialError} />
        </div>
      </main>
    </div>
  );
}

function humanizeAuthError(description: string, code?: string): string {
  if (code === 'otp_expired' || description.includes('expired')) {
    return 'That link expired (often Gmail\'s scanner consumes it before you click). Use the 6-digit code from the same email instead.';
  }
  return decodeURIComponent(description.replace(/\+/g, ' '));
}
