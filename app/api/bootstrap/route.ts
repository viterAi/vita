import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    tenantId: data?.tenant_id ?? null,
    role: data?.role ?? null,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Bootstrap seed is disabled. Use GET to fetch session info." },
    { status: 405 },
  );
}
