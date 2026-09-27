import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/jobs/[jobId] — where a piece of background work stands (see
 * src/lib/jobs). RLS lets the wedding's members read their own jobs only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const { data } = await supabase.from("jobs").select("status, error, result").eq("id", jobId).maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}
