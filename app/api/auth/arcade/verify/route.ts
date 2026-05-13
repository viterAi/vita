import { NextResponse } from "next/server";
import { Arcade } from "@arcadeai/arcadejs";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Custom Arcade user verifier route.
 *
 * Register this URL in the Arcade Dashboard → Auth → Settings → Custom Verifier:
 *   https://your-app.com/api/auth/arcade/verify
 *
 * Arcade calls this route (GET) during an authorization flow to verify the user's
 * identity. We confirm the user matches the signed-in session, then redirect to
 * Arcade's next_uri so the flow can complete.
 *
 * During development: you can skip registering this and use Arcade's built-in
 * verifier instead (sign-in to Arcade.dev).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const flowId = searchParams.get("flow_id");
  const nextUri = searchParams.get("next_uri");

  // Log all params Arcade sends so we can inspect the exact shape
  console.log("[arcade/verify] params:", Object.fromEntries(searchParams.entries()));

  if (!flowId) {
    return new NextResponse("Missing flow_id", { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const apiKey = process.env.ARCADE_API_KEY;
  if (!apiKey) {
    return new NextResponse("ARCADE_API_KEY not configured", { status: 500 });
  }

  const client = new Arcade({ apiKey });

  // Must match the user_id passed to auth.start() in the /start route
  const arcadeUserId = user.email ?? user.id;

  try {
    console.log("[arcade/verify] confirmUser →", { flow_id: flowId, user_id: arcadeUserId });
    const result = await client.auth.confirmUser({ flow_id: flowId, user_id: arcadeUserId });
    console.log("[arcade/verify] confirmUser result:", result);
    const redirectTo =
      result.next_uri ??
      nextUri ??
      (result.auth_id
        ? `/auth/arcade/done?auth_id=${encodeURIComponent(result.auth_id)}`
        : "/auth/arcade/done");
    return NextResponse.redirect(redirectTo);
  } catch (err) {
    console.error("[arcade/verify] confirmUser failed:", err);
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : "Verification failed";
    return new NextResponse(
      `Arcade verification failed. Sign in to the app with the same account that started connect, then try again.\n\n${message}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}
