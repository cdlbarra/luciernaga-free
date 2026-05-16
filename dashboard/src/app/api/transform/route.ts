import { createClient } from "@supabase/supabase-js";
import { extractRecords, transformRecord } from "@/lib/transformer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const { ingestor_id, raw_data_id } = await req.json();

    const { data: rawRow, error } = await supabase
      .from("raw_data")
      .select("data")
      .eq("id", raw_data_id)
      .single();

    if (error || !rawRow) {
      return Response.json({ success: false, detail: "Registro no encontrado" });
    }

    const records = extractRecords(rawRow.data);
    const transformed = records.map(transformRecord);

    await supabase
      .from("transformed_data")
      .insert({ ingestor_id, raw_data_id, data: transformed });

    await supabase.from("pipeline_runs").insert({
      ingestor_id,
      report: { action: "transform", records_processed: transformed.length },
      quality_score: 100,
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, detail: String(e) });
  }
}
