import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureSpecQuality } from "@/lib/view/spec-quality";
import type { PersistedViewSpec } from "@/lib/types/view-builder";

const dupSchema = z.object({
  viewName: z.string().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const body = dupSchema.safeParse(await request.json().catch(() => ({}))).data ?? {};
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: srcView, error: fetchError } = await supabase
    .from("views")
    .select("*")
    .eq("id", viewId)
    .maybeSingle();
  if (fetchError || !srcView) {
    return NextResponse.json({ error: fetchError?.message ?? "not_found" }, { status: fetchError ? 500 : 404 });
  }

  const { data: memberData } = await supabase.from("tenant_members").select("tenant_id").limit(1).maybeSingle();
  const tenantData = memberData?.tenant_id ?? null;

  const { data: maxSortRecord } = await supabase
    .from("views")
    .select("sort_order")
    .eq("source_id", srcView.source_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (maxSortRecord?.sort_order ?? -1) + 1;
  const spec = ensureSpecQuality(srcView.spec as PersistedViewSpec);
  const name = body.viewName ?? `Copy of ${srcView.view_name}`;

  const { data: inserted, error: insertError } = await supabase
    .from("views")
    .insert({
      source_id: srcView.source_id,
      view_name: name,
      view_type: srcView.view_type,
      sort_order: nextSort,
      is_default: false,
      current_spec_version: 1,
      spec,
      ui_state: { ...(srcView.ui_state as Record<string, unknown>), steer_messages: [] },
      tenant_id: tenantData,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
  }

  const { error: verError } = await supabase.from("view_versions").insert({
    view_id: inserted.id,
    version_number: 1,
    spec,
    summary: `Duplicated from ${srcView.view_name}`,
  });
  if (verError) return NextResponse.json({ error: verError.message }, { status: 500 });

  return NextResponse.json({ view: inserted }, { status: 201 });
}
