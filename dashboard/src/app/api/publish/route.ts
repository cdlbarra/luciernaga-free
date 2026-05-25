import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generarReportValidacion } from "@/lib/dataValidator";
import { verificarSesion } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function parseFile(file: File, sourceType: string): Promise<Record<string, unknown>> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (sourceType === "json") {
    return JSON.parse(buffer.toString("utf-8"));
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  return { rows };
}

export async function POST(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";

  let name: string;
  let source_type: string;
  let fileData: Record<string, unknown> | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    name = (form.get("name") as string)?.trim();
    source_type = form.get("source_type") as string;
    const file = form.get("file") as File | null;

    if (!name || !source_type) {
      return Response.json({ error: "Nombre y tipo de fuente son requeridos" }, { status: 400 });
    }

    if (file && file.size > 0) {
      try {
        fileData = await parseFile(file, source_type);
      } catch {
        return Response.json({ error: "No se pudo parsear el archivo" }, { status: 400 });
      }
    }
  } else {
    const contrato = await req.json();
    if (!contrato.name || !contrato.source_type) {
      return Response.json({ error: "Contrato inválido" }, { status: 400 });
    }
    name = contrato.name;
    source_type = contrato.source_type;
  }

  const contrato = { name, source_type, config: {} };

  const { data, error } = await supabase
    .from("ingestors")
    .insert({ name, contract: contrato, status: "active", company_id: sesion.company_id })
    .select()
    .single();

  if (error) return Response.json({ error }, { status: 500 });

  if (fileData) {
    const rows: Record<string, unknown>[] = Array.isArray(fileData)
      ? fileData as Record<string, unknown>[]
      : Array.isArray((fileData as Record<string, unknown>).rows)
        ? (fileData as Record<string, unknown>).rows as Record<string, unknown>[]
        : [];

    const validationReport = generarReportValidacion(rows);
    const validationStatus = validationReport.resumen.tiene_errores ? "errors"
      : validationReport.resumen.tiene_advertencias ? "warnings"
      : "valid";

    const rawDataInsert = await supabase
      .from("raw_data")
      .insert({
        ingestor_id: data.id,
        company_id: sesion.company_id,
        data: fileData,
        uploaded_by: sesion.user_id,
        company: sesion.company_id,
        data_type: "raw",
        uploaded_at: new Date().toISOString(),
        validation_report: validationReport,
        validation_status: validationStatus,
      });

  }

  if (fileData && process.env.INGESTOR_URL) {
    try {
      await fetch(`${process.env.INGESTOR_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: fileData, ingestor_id: data.id }),
      });
    } catch {
      // best-effort: el contrato ya quedó guardado en Supabase
    }
  }

  return Response.json(data);
}

export async function GET(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await supabase
    .from("ingestors")
    .select("*")
    .eq("company_id", sesion.company_id)
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}

export async function DELETE(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ID requerido" }, { status: 400 });

  const { error } = await supabase
    .from("ingestors")
    .delete()
    .eq("id", id)
    .eq("company_id", sesion.company_id);
  if (error) return Response.json({ error }, { status: 500 });

  return new Response(null, { status: 204 });
}
