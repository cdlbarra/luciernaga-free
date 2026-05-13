import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractSourceMeta(source: unknown): { columns: string[]; recordCount: number; previewRows: Record<string, unknown>[] } {
  if (!source || typeof source !== "object") return { columns: [], recordCount: 0, previewRows: [] };

  const src = source as Record<string, unknown>;

  if (Array.isArray(src.rows) && src.rows.length > 0) {
    return {
      columns: Object.keys(src.rows[0] as object),
      recordCount: src.rows.length,
      previewRows: (src.rows as Record<string, unknown>[]).slice(0, 5),
    };
  }

  if (Array.isArray(source) && (source as unknown[]).length > 0) {
    return {
      columns: Object.keys((source as unknown[])[0] as object),
      recordCount: (source as unknown[]).length,
      previewRows: (source as Record<string, unknown>[]).slice(0, 5),
    };
  }

  const keys = Object.keys(src).filter(k => !["errors", "quality", "source"].includes(k));
  return { columns: keys, recordCount: keys.length > 0 ? 1 : 0, previewRows: [] };
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const [{ data: ingestor, error }, { data: runs }] = await Promise.all([
    supabase.from("ingestors").select("*").eq("id", id).single(),
    supabase
      .from("pipeline_runs")
      .select("*")
      .eq("ingestor_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (error || !ingestor) {
    return Response.json({ error: "Ingestor no encontrado" }, { status: 404 });
  }

  const run = runs?.[0] ?? null;
  const report = (run?.report ?? {}) as Record<string, unknown>;
  const { columns, recordCount, previewRows } = extractSourceMeta(report.source);
  const errors: unknown[] = Array.isArray(report.errors) ? report.errors : [];

  return Response.json({
    id: ingestor.id,
    name: ingestor.name,
    source_type: ingestor.source_type ?? ingestor.contract?.source_type,
    status: ingestor.status,
    created_at: ingestor.created_at,
    quality_score: run?.quality_score ?? null,
    columns,
    record_count: recordCount,
    preview_rows: previewRows,
    errors,
    last_run: run?.created_at ?? null,
  });
}
