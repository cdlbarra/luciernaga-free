import { verificarSesion } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { generarReportValidacion } from "@/lib/dataValidator";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.rows)) return d.rows as Record<string, unknown>[];
    if (Array.isArray(d.records)) return d.records as Record<string, unknown>[];
  }
  return [];
}

function solucionPara(campo: string, tipo?: string): string {
  if (tipo === "date") return "Normalizar fechas a formato ISO (YYYY-MM-DD)";
  if (tipo === "number") return "Rellenar nulos con promedio o mediana";
  if (tipo === "email") return "Verificar y corregir formato de emails";
  return "Revisar y limpiar valores inconsistentes";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await context.params;
  console.log("[suggest] ingestor_id recibido:", id);

  const { data: rows, error } = await supabase
    .from("raw_data")
    .select("id, data")
    .eq("ingestor_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("[suggest] rows:", rows, "error:", error);

  const rawRecord = rows?.[0] ?? null;

  if (!rawRecord) {
    return Response.json({ sugerencias: [], total_registros: 0, raw_data_id: null });
  }

  const records = extractRecords(rawRecord.data);
  const report = generarReportValidacion(records);

  const sugerencias = [
    ...report.errores.map((e) => ({
      tipo: "error",
      campo: e.campo,
      problema: e.mensaje,
      solucion: solucionPara(e.campo, report.tipos_detectados[e.campo]),
    })),
    ...report.advertencias.map((e) => ({
      tipo: "warning",
      campo: e.campo,
      problema: e.mensaje,
      solucion: solucionPara(e.campo, report.tipos_detectados[e.campo]),
    })),
    ...report.sugerencias.map((e) => ({
      tipo: "suggestion",
      campo: e.campo,
      problema: e.mensaje,
      solucion: solucionPara(e.campo, report.tipos_detectados[e.campo]),
    })),
  ];

  return Response.json({
    sugerencias,
    total_registros: records.length,
    raw_data_id: rawRecord.id,
    completitud: report.resumen.porcentaje_completitud,
  });
}
