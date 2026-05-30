import { createClient } from "@supabase/supabase-js";
import { verificarSesion } from "@/lib/auth";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DB_INGESTOR_SERVICE_URL = process.env.DB_INGESTOR_SERVICE_URL ?? "http://localhost:8000";

function descifrarPassword(encrypted: string): string {
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) return encrypted;
  try {
    const [ivB64, encB64] = encrypted.split(":");
    if (!ivB64 || !encB64) return encrypted;
    const key = crypto.createHash("sha256").update(secretKey).digest();
    const iv = Buffer.from(ivB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return encrypted;
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await context.params;

  const { data: ing, error } = await supabase
    .from("db_ingestors")
    .select("id, db_type, host, port, database, username, password_encrypted, query")
    .eq("id", id)
    .eq("company_id", sesion.company_id)
    .single();

  if (error || !ing) return Response.json({ error: "Ingestor no encontrado" }, { status: 404 });

  try {
    const res = await fetch(`${DB_INGESTOR_SERVICE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        db_ingestor_id: ing.id,
        connection: {
          db_type: ing.db_type,
          host: ing.host,
          port: ing.port,
          database: ing.database,
          username: ing.username,
          password: descifrarPassword(ing.password_encrypted),
        },
        query: ing.query,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ detail: data.detail ?? "Error al ejecutar" }, { status: 502 });
    return Response.json(data);
  } catch {
    return Response.json({ detail: "El servicio de BD no respondió" }, { status: 503 });
  }
}
