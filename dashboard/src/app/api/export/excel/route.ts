import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

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

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!ids?.length) return Response.json({ error: "IDs requeridos" }, { status: 400 });

  const { data, error } = await supabase
    .from("raw_data")
    .select("data")
    .in("id", ids);

  if (error) return Response.json({ error }, { status: 500 });

  const rows = (data ?? []).flatMap(r => extractRows(r.data));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "raw_data");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="raw_data_${Date.now()}.xlsx"`,
    },
  });
}
