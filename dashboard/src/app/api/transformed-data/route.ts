import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ingestorId = searchParams.get("ingestor_id");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = 10;

  if (!ingestorId) {
    return Response.json({ error: "ingestor_id es requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transformed_data")
    .select("id, data, created_at")
    .eq("ingestor_id", ingestorId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return Response.json({ error }, { status: 500 });

  if (!data || data.length === 0) {
    return Response.json({ rows: [], columns: [], total: 0, page: 1, totalPages: 0 });
  }

  const rawData = data[0].data;
  const allRows: Record<string, unknown>[] = Array.isArray(rawData) ? rawData : [];

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = allRows.slice(start, start + pageSize);

  const columns = allRows.length > 0 ? Object.keys(allRows[0]) : [];

  const columnTypes: Record<string, "number" | "date" | "boolean" | "string"> = {};
  for (const col of columns) {
    const sample = allRows.slice(0, 20).map(r => r[col]).filter(v => v !== null && v !== undefined);
    const numCount = sample.filter(v => typeof v === "number").length;
    const boolCount = sample.filter(v => typeof v === "boolean").length;
    const dateCount = sample.filter(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v as string)).length;

    if (numCount / sample.length > 0.7) columnTypes[col] = "number";
    else if (boolCount / sample.length > 0.7) columnTypes[col] = "boolean";
    else if (dateCount / sample.length > 0.7) columnTypes[col] = "date";
    else columnTypes[col] = "string";
  }

  return Response.json({
    rows: pageRows,
    columns,
    columnTypes,
    total,
    page: safePage,
    totalPages,
    transformedAt: data[0].created_at,
  });
}
