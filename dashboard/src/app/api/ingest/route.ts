import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const { source, ingestor_id } = await req.json();

    const recordCount = Array.isArray(source?.data) ? source.data.length : 0;
    const report = {
      source_type: source?.source_type ?? "unknown",
      records: recordCount,
      status: "ok",
    };

    await supabase.from("pipeline_runs").insert({
      ingestor_id,
      report,
      quality_score: 80,
    });

    return Response.json({ ...report, quality: 80 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
