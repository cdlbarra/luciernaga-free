import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generarReportValidacion } from "@/lib/dataValidator";

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

  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  const sourceType = name.endsWith(".csv") ? "csv" : "excel";
  return { rows, sourceType };
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

      const { rows, sourceType } = await parseFile(file);
      const validationReport = generarReportValidacion(rows);
      const validationStatus = validationReport.resumen.tiene_errores
        ? "errors"
        : validationReport.resumen.tiene_advertencias
          ? "warnings"
          : "valid";

      const { error: rawError } = await supabase.from("raw_data").insert({
        ingestor_id: ingestorId,
        data: rows,
        uploaded_by: req.headers.get("x-user-id") ?? "anonymous",
        company: req.headers.get("x-company") ?? "default",
        data_type: "raw",
        uploaded_at: new Date().toISOString(),
        validation_report: validationReport,
        validation_status: validationStatus,
      });

      if (rawError) {
        return Response.json({ success: false, message: rawError.message }, { status: 500 });
      }

      if (process.env.INGESTOR_URL) {
        try {
          await fetch(`${process.env.INGESTOR_URL}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: { rows, source_type: sourceType }, ingestor_id: ingestorId }),
          });
        } catch {
          // best-effort
        }
      }

      return Response.json({ success: true, message: "Archivo procesado", rowsProcessed: rows.length });
    }

    // Legacy JSON path: { source: { data: [], source_type }, ingestor_id }
    const { source, ingestor_id } = await req.json();
    const rows: Record<string, unknown>[] = Array.isArray(source?.data) ? source.data : [];
    const sourceType: string = source?.source_type ?? "csv";

    const validationReport = generarReportValidacion(rows);
    const validationStatus = validationReport.resumen.tiene_errores
      ? "errors"
      : validationReport.resumen.tiene_advertencias
        ? "warnings"
        : "valid";

    const { error: rawError } = await supabase.from("raw_data").insert({
      ingestor_id,
      data: rows,
      uploaded_by: "android-mock",
      company: "default",
      data_type: "raw",
      uploaded_at: new Date().toISOString(),
      validation_report: validationReport,
      validation_status: validationStatus,
    });

    if (rawError) {
      return Response.json({ success: false, message: rawError.message }, { status: 500 });
    }

    if (process.env.INGESTOR_URL) {
      try {
        await fetch(`${process.env.INGESTOR_URL}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: { rows, source_type: sourceType }, ingestor_id }),
        });
      } catch {
        // best-effort
      }
    }

    return Response.json({ success: true, message: "Datos mock procesados", rowsProcessed: rows.length });
  } catch (e) {
    return Response.json({ success: false, message: String(e) }, { status: 500 });
  }
}
