import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  viewName: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  /** Shallow-merged into existing `views.ui_state` (e.g. steer_messages). */
  ui_state: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: view, error } = await supabase.from("views").select("*").eq("id", viewId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ view });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const body = patchSchema.parse(await request.json());
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("views")
    .select("*")
    .eq("id", viewId)
    .maybeSingle();
  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message ?? "not_found" }, { status: fetchError ? 500 : 404 });
  }

  if (body.isDefault === true) {
    await supabase.from("views").update({ is_default: false }).eq("source_id", existing.source_id);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.viewName !== undefined) patch.view_name = body.viewName;
  if (body.isDefault !== undefined) patch.is_default = body.isDefault;
  if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
  if (body.ui_state !== undefined) {
    patch.ui_state = { ...(existing.ui_state as Record<string, unknown>), ...body.ui_state };
  }

  const { data: updated, error: updateError } = await supabase
    .from("views")
    .update(patch)
    .eq("id", viewId)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ view: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("views").delete().eq("id", viewId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
