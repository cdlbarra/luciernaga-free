import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generarReportValidacion } from "@/lib/dataValidator";
import { extractRecords, transformRecord } from "@/lib/transformer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function parseFile(file: File): Promise<{ rows: Record<string, unknown>[]; sourceType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
    return { rows, sourceType: "json" };
  }

  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: "" });
  const sourceType = name.endsWith(".csv") ? "csv" : "excel";
  return { rows, sourceType };
}

async function saveAndTransform(
  ingestorId: string,
  rows: Record<string, unknown>[],
  uploadedBy: string,
) {
  const validationReport = generarReportValidacion(rows);
  const validationStatus = validationReport.resumen.tiene_errores
    ? "errors"
    : validationReport.resumen.tiene_advertencias
      ? "warnings"
      : "valid";

  const { data: rawInsert, error: rawError } = await supabase
    .from("raw_data")
    .insert({
      ingestor_id: ingestorId,
      data: rows,
      uploaded_by: uploadedBy,
      company: "default",
      data_type: "raw",
      uploaded_at: new Date().toISOString(),
      validation_report: validationReport,
      validation_status: validationStatus,
    })
    .select("id")
    .single();

  if (rawError) return { error: rawError.message };

  const transformed = extractRecords(rows).map(transformRecord);

  const { error: transformError } = await supabase
    .from("transformed_data")
    .insert({ ingestor_id: ingestorId, raw_data_id: rawInsert.id, data: transformed });

  if (transformError) return { error: transformError.message };

  return { rowsProcessed: transformed.length };
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const ingestorId = form.get("ingestor_id") as string | null;
      const file = form.get("file") as File | null;

      if (!ingestorId) {
        return Response.json({ success: false, message: "ingestor_id es requerido" }, { status: 400 });
      }
      if (!file || file.size === 0) {
        return Response.json({ success: false, message: "file es requerido" }, { status: 400 });
      }

      const { rows } = await parseFile(file);
      const result = await saveAndTransform(
        ingestorId,
        rows,
        req.headers.get("x-user-id") ?? "anonymous",
      );

      if (result.error) {
        return Response.json({ success: false, message: result.error }, { status: 500 });
      }
      return Response.json({ success: true, message: "Archivo procesado", rowsProcessed: result.rowsProcessed });
    }

    // JSON path: { source: { data: [], source_type }, ingestor_id }
    const { source, ingestor_id } = await req.json();
    const rows: Record<string, unknown>[] = Array.isArray(source?.data) ? source.data : [];

    const result = await saveAndTransform(ingestor_id, rows, "android");

    if (result.error) {
      return Response.json({ success: false, message: result.error }, { status: 500 });
    }
    return Response.json({ success: true, message: "Datos procesados", rowsProcessed: result.rowsProcessed });
  } catch (e) {
    return Response.json({ success: false, message: String(e) }, { status: 500 });
  }
}
