import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decodeSourceIdPathSegment } from "@/lib/genui/source-key";

const reorderSchema = z.object({
  orderedViewIds: z.array(z.string().uuid()).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await params;
  const sourceKey = decodeSourceIdPathSegment(sourceId);
  const body = reorderSchema.parse(await request.json());
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: rows, error: listError } = await supabase
    .from("views")
    .select("id")
    .eq("source_id", sourceKey);
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const allowed = new Set((rows ?? []).map((r) => r.id));
  for (const id of body.orderedViewIds) {
    if (!allowed.has(id)) {
      return NextResponse.json({ error: `View ${id} does not belong to this source.` }, { status: 400 });
    }
  }

  if (body.orderedViewIds.length !== allowed.size) {
    return NextResponse.json({ error: "orderedViewIds must include every view for this source." }, { status: 400 });
  }

  for (let i = 0; i < body.orderedViewIds.length; i++) {
    const id = body.orderedViewIds[i]!;
    const { error } = await supabase.from("views").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: views, error: fetchError } = await supabase
    .from("views")
    .select("*")
    .eq("source_id", sourceKey)
    .order("sort_order", { ascending: true });
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ views: views ?? [] });
}
