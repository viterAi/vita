import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureSpecQuality } from "@/lib/view/spec-quality";
import type { PersistedViewSpec } from "@/lib/types/view-builder";

const restoreSchema = z.object({
  versionNumber: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const body = restoreSchema.parse(await request.json());
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: existingView, error: fetchError } = await supabase
    .from("views")
    .select("*")
    .eq("id", viewId)
    .maybeSingle();
  if (fetchError || !existingView) {
    return NextResponse.json({ error: fetchError?.message ?? "View not found" }, { status: fetchError ? 500 : 404 });
  }

  const { data: snapshot, error: verError } = await supabase
    .from("view_versions")
    .select("*")
    .eq("view_id", viewId)
    .eq("version_number", body.versionNumber)
    .maybeSingle();
  if (verError || !snapshot) {
    return NextResponse.json({ error: verError?.message ?? "Version not found" }, { status: verError ? 500 : 404 });
  }

  const qualityCheckedSpec = ensureSpecQuality(snapshot.spec as PersistedViewSpec);
  const nextVersion = existingView.current_spec_version + 1;

  const { error: versionInsertError } = await supabase.from("view_versions").insert({
    view_id: viewId,
    version_number: nextVersion,
    spec: qualityCheckedSpec,
    summary: `Restored from version ${body.versionNumber}`,
  });
  if (versionInsertError) {
    return NextResponse.json({ error: versionInsertError.message }, { status: 500 });
  }

  const { data: updatedView, error: updateError } = await supabase
    .from("views")
    .update({
      spec: qualityCheckedSpec,
      current_spec_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", viewId)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    view: updatedView,
    message: `Restored layout from version ${body.versionNumber} as version ${nextVersion}.`,
  });
}
