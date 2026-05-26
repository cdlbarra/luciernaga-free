import { verificarSesion } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// seriales de fecha Excel → ISO string
function excelSerialToISO(serial: number): string {
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split("T")[0];
}

function isExcelSerial(v: unknown): v is number {
  return typeof v === "number" && v >= 40000 && v <= 50000;
}

export async function GET(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

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

  const columns = allRows.length > 0 ? Object.keys(allRows[0]) : [];

  // Detectar tipos y columnas con seriales Excel
  const columnTypes: Record<string, "number" | "date" | "boolean" | "string"> = {};
  const excelDateCols = new Set<string>();

  for (const col of columns) {
    const sample = allRows.slice(0, 20).map(r => r[col]).filter(v => v !== null && v !== undefined);
    if (sample.length === 0) { columnTypes[col] = "string"; continue; }

    const numCount = sample.filter(v => typeof v === "number").length;
    const boolCount = sample.filter(v => typeof v === "boolean").length;
    const dateStrCount = sample.filter(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v as string)).length;

    if (boolCount / sample.length > 0.7) {
      columnTypes[col] = "boolean";
    } else if (dateStrCount / sample.length > 0.7) {
      columnTypes[col] = "date";
    } else if (numCount / sample.length > 0.7) {
      // si la mayoría son seriales Excel, reclasificar como fecha
      const serialCount = sample.filter(isExcelSerial).length;
      if (serialCount / sample.length > 0.7) {
        // si la mayoría son seriales Excel, reclasificar como fecha
        columnTypes[col] = "date";
        excelDateCols.add(col);
      } else {
        columnTypes[col] = "number";
      }
    } else {
      columnTypes[col] = "string";
    }
  }

  // convertir seriales Excel a ISO strings en todas las filas
  const excelDateColsArr = Array.from(excelDateCols);
  const processedRows = excelDateColsArr.length === 0
    ? allRows
    : allRows.map(row => {
        const out = { ...row };
        for (const col of excelDateColsArr) {
          if (isExcelSerial(out[col])) out[col] = excelSerialToISO(out[col] as number);
        }
        return out;
      });

  const total = processedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = processedRows.slice(start, start + pageSize);

  return new Response(JSON.stringify({
    rows: pageRows,
    columns,
    columnTypes,
    total,
    page: safePage,
    totalPages,
    transformedAt: data[0].created_at,
  }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
