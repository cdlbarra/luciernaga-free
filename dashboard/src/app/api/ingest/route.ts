import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generarReportValidacion } from "@/lib/dataValidator";
import { extractRecords, transformRecord } from "@/lib/transformer";
import { verificarSesion } from "@/lib/auth";

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
  console.log('PRIMERA FILA RAW:', JSON.stringify(rows[0]));
  const sourceType = name.endsWith(".csv") ? "csv" : "excel";
  return { rows, sourceType };
}

async function saveAndTransform(
  ingestorId: string,
  rows: Record<string, unknown>[],
  uploadedBy: string,
  companyId: string,
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
      company_id: companyId,
      company: companyId,
      data_type: "raw",
      uploaded_at: new Date().toISOString(),
      validation_report: validationReport,
      validation_status: validationStatus,
    })
    .select("id")
    .single();

  if (rawError) {
    await supabase.from("pipeline_runs").insert({
      ingestor_id: ingestorId,
      status: "error",
      rows_processed: 0,
      error_message: rawError.message,
      created_at: new Date().toISOString(),
    });
    return { error: rawError.message };
  }

  const transformed = extractRecords(rows).map(transformRecord);

  const { error: transformError } = await supabase
    .from("transformed_data")
    .insert({ ingestor_id: ingestorId, raw_data_id: rawInsert.id, data: transformed });

  if (transformError) {
    await supabase.from("pipeline_runs").insert({
      ingestor_id: ingestorId,
      status: "error",
      rows_processed: 0,
      error_message: transformError.message,
      created_at: new Date().toISOString(),
    });
    return { error: transformError.message };
  }

  const { error: runError } = await supabase.from("pipeline_runs").insert({
    ingestor_id: ingestorId,
    status: "success",
    rows_processed: transformed.length,
    error_message: null,
    created_at: new Date().toISOString(),
  });

  if (runError) {
    console.error('PIPELINE RUN ERROR:', JSON.stringify(runError));
  } else {
    console.log('PIPELINE RUN OK: guardado correctamente');
  }

  const { error: updateError } = await supabase
    .from("ingestors")
    .update({
      registros_procesados: transformed.length,
      columnas_detectadas: transformed.length > 0 ? Object.keys(transformed[0]).length : 0,
    })
    .eq("id", ingestorId);

  console.log('UPDATE INGESTOR:', updateError ? JSON.stringify(updateError) : 'OK', 'rows:', transformed.length);

  return { rowsProcessed: transformed.length };
}

export async function POST(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ success: false, message: "No autorizado" }, { status: 401 });

  let ingestorId: string | null = null;
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const { searchParams } = new URL(req.url);
      const form = await req.formData();
      ingestorId = (searchParams.get("ingestor_id") || form.get("ingestor_id")) as string | null;
      const file = form.get("file") as File | null;

      if (!ingestorId) {
        return Response.json({ success: false, message: "ingestor_id es requerido" }, { status: 400 });
      }
      if (!file || file.size === 0) {
        return Response.json({ success: false, message: "file es requerido" }, { status: 400 });
      }

      const { data: ingestorCheck } = await supabase
        .from("ingestors")
        .select("id")
        .eq("id", ingestorId)
        .eq("company_id", sesion.company_id)
        .single();
      if (!ingestorCheck) return Response.json({ success: false, message: "Ingestor no encontrado" }, { status: 404 });

      const { rows } = await parseFile(file);
      const result = await saveAndTransform(
        ingestorId,
        rows,
        sesion.user_id,
        sesion.company_id,
      );

      if (result.error) {
        return Response.json({ success: false, message: result.error }, { status: 500 });
      }
      return Response.json({ success: true, message: "Archivo procesado", rowsProcessed: result.rowsProcessed });
    }

    // JSON path: { source: { data: [], source_type }, ingestor_id }
    const { source, ingestor_id } = await req.json();
    ingestorId = ingestor_id ?? null;

    const { data: ingestorCheck } = await supabase
      .from("ingestors")
      .select("id")
      .eq("id", ingestorId!)
      .eq("company_id", sesion.company_id)
      .single();
    if (!ingestorCheck) return Response.json({ success: false, message: "Ingestor no encontrado" }, { status: 404 });

    const rows: Record<string, unknown>[] = Array.isArray(source?.data) ? source.data : [];

    const result = await saveAndTransform(ingestorId!, rows, sesion.user_id, sesion.company_id);

    if (result.error) {
      return Response.json({ success: false, message: result.error }, { status: 500 });
    }
    return Response.json({ success: true, message: "Datos procesados", rowsProcessed: result.rowsProcessed });
  } catch (e) {
    if (ingestorId) {
      await supabase.from("pipeline_runs").insert({
        ingestor_id: ingestorId,
        status: "error",
        rows_processed: 0,
        error_message: String(e),
        created_at: new Date().toISOString(),
      });
    }
    return Response.json({ success: false, message: String(e) }, { status: 500 });
  }
}
