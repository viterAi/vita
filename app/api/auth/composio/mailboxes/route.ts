import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasComposio } from "@/lib/composio/client";
import { getComposioAccessTokenDetailed } from "@/lib/composio/tokens";

export const dynamic = "force-dynamic";

const MASKING_HINT =
  "Composio is masking access tokens. In Composio → Settings → Project Configuration, disable “Mask Connected Account Secrets”, then reconnect Gmail.";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const authId = searchParams.get("auth_id");
  const provider = searchParams.get("provider");

  if (!authId || !provider) {
    return NextResponse.json({ error: "Missing auth_id or provider" }, { status: 400 });
  }
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "provider must be google or microsoft" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!hasComposio()) {
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });
  }

  const tokenResult = await getComposioAccessTokenDetailed(authId);
  if (!tokenResult.ok) {
    if (tokenResult.reason === "masked") {
      return NextResponse.json({ error: MASKING_HINT }, { status: 503 });
    }
    if (tokenResult.reason === "inactive") {
      return NextResponse.json({ error: "Authorization not yet completed" }, { status: 202 });
    }
    return NextResponse.json({ error: "No access token on connected account — try reconnecting." }, { status: 503 });
  }
  const token = tokenResult.token;

  if (provider === "google") {
    // Gmail connect scopes are gmail.* — not userinfo.* — so use Gmail API profile.
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileRes.ok) {
      const detail = await profileRes.text();
      return NextResponse.json(
        { error: `Gmail profile failed (${profileRes.status}). ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const profile = (await profileRes.json()) as { emailAddress?: string };
    const email = profile.emailAddress ?? "";
    if (!email) {
      return NextResponse.json({ error: "Gmail profile did not return an email address" }, { status: 502 });
    }
    return NextResponse.json({
      mailboxes: [{ id: email, label: email, email }],
    });
  }

  const msRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!msRes.ok) {
    const detail = await msRes.text();
    return NextResponse.json(
      { error: `Outlook profile failed (${msRes.status}). ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }
  const ms = (await msRes.json()) as { displayName?: string; mail?: string; userPrincipalName?: string };
  const email = ms.mail ?? ms.userPrincipalName ?? "primary";
  return NextResponse.json({
    mailboxes: [
      {
        id: email,
        label: ms.displayName ? `${ms.displayName} (${email})` : email,
        email,
      },
    ],
  });
}
