import { createClient } from "@supabase/supabase-js";
import { verificarSesion } from "@/lib/auth";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DB_INGESTOR_SERVICE_URL = process.env.DB_INGESTOR_SERVICE_URL ?? "http://localhost:8000";

function cifrarPassword(password: string): string {
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) return password;
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${encrypted.toString("base64")}`;
}

export async function GET(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("db_ingestors")
    .select("id, nombre, db_type, schedule, last_run_at, last_run_status, last_rows_ingested")
    .eq("company_id", sesion.company_id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  if (body.solo_probar) {
    try {
      const res = await fetch(`${DB_INGESTOR_SERVICE_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_ingestor_id: "test",
          connection: {
            db_type: body.db_type,
            host: body.host,
            port: body.port,
            database: body.database,
            username: body.username,
            password: body.password,
          },
          query: "SELECT 1",
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return Response.json({ ok: true });
      const err = await res.json();
      return Response.json({ error: err.detail ?? "Conexión fallida" }, { status: 400 });
    } catch {
      return Response.json({ error: "No se pudo conectar al servicio de BD" }, { status: 503 });
    }
  }

  const { nombre, descripcion, db_type, host, port, database, username, password, query, schedule } = body;

  if (!nombre?.trim()) return Response.json({ error: "nombre es requerido" }, { status: 400 });
  if (!host?.trim()) return Response.json({ error: "host es requerido" }, { status: 400 });
  if (!database?.trim()) return Response.json({ error: "database es requerido" }, { status: 400 });
  if (!username?.trim()) return Response.json({ error: "username es requerido" }, { status: 400 });
  if (!password) return Response.json({ error: "password es requerido" }, { status: 400 });
  if (!query?.trim()) return Response.json({ error: "query es requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("db_ingestors")
    .insert({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() ?? null,
      db_type,
      host: host.trim(),
      port: Number(port),
      database_name: database.trim(),
      db_user: username.trim(),
      db_password_encrypted: cifrarPassword(password),
      query: query.trim(),
      schedule: schedule ?? "cada_24h",
      company_id: sesion.company_id,
    })
    .select()
    .single();

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data, { status: 201 });
}
