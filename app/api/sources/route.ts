import { NextResponse } from "next/server";
import { getMockChats } from "../../../lib/l0/mock-data";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  return NextResponse.json({ sources: getMockChats() });
}
