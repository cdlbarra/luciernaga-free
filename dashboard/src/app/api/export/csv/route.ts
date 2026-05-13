import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractRows(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === "object" && Array.isArray((data as Record<string, unknown>).rows))
    return (data as Record<string, unknown>).rows as Record<string, unknown>[];
  return [];
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
  ].join("\n");
}

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!ids?.length) return Response.json({ error: "IDs requeridos" }, { status: 400 });

  const { data, error } = await supabase
    .from("raw_data")
    .select("data")
    .in("id", ids);

  if (error) return Response.json({ error }, { status: 500 });

  const rows = (data ?? []).flatMap(r => extractRows(r.data));
  const csv = toCSV(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raw_data_${Date.now()}.csv"`,
    },
  });
}
