import { createClient } from "@supabase/supabase-js";
import { extractRecords, transformRecord } from "@/lib/transformer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const { ingestor_id, raw_data_id } = await req.json();
    console.log("[transform] ingestor_id:", ingestor_id, "raw_data_id:", raw_data_id);

    const { data: rows, error: fetchError } = await supabase
      .from("raw_data")
      .select("data")
      .eq("id", raw_data_id)
      .limit(1);

    console.log("[transform] raw_data fetch — rows:", rows?.length, "error:", fetchError);

    const rawRow = rows?.[0] ?? null;
    if (fetchError || !rawRow) {
      return Response.json({ success: false, detail: fetchError?.message ?? "Registro no encontrado" });
    }

    const records = extractRecords(rawRow.data);
    const transformed = records.map(transformRecord);
    console.log("[transform] registros transformados:", transformed.length);

    const { error: insertError } = await supabase
      .from("transformed_data")
      .insert({ ingestor_id, data: transformed });

    console.log("[transform] insert transformed_data error:", insertError);

    if (insertError) {
      return Response.json({ success: false, detail: insertError.message });
    }

    const { error: runError } = await supabase.from("pipeline_runs").insert({
      ingestor_id,
      report: { action: "transform", records_processed: transformed.length },
      quality_score: 100,
    });

    console.log("[transform] insert pipeline_runs error:", runError);

    return Response.json({ success: true, records_processed: transformed.length });
  } catch (e) {
    console.error("[transform] excepción:", e);
    return Response.json({ success: false, detail: String(e) });
  }
}
