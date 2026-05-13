import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractRowCount(data: unknown): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === "object" && Array.isArray((data as Record<string, unknown>).rows))
    return ((data as Record<string, unknown>).rows as unknown[]).length;
  return 0;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uploadedBy = searchParams.get("uploaded_by");
  const company = searchParams.get("company");

  let query = supabase
    .from("raw_data")
    .select("id, ingestor_id, uploaded_by, company, data_type, uploaded_at, created_at, data")
    .order("uploaded_at", { ascending: false });

  if (uploadedBy) query = query.eq("uploaded_by", uploadedBy);
  if (company) query = query.eq("company", company);

  const { data, error } = await query;
  if (error) return Response.json({ error }, { status: 500 });

  const records = (data ?? []).map(({ data: rowData, ...rest }) => ({
    ...rest,
    record_count: extractRowCount(rowData),
  }));

  return Response.json(records);
}
