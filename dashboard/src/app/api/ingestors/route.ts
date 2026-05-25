import { createClient } from "@supabase/supabase-js";
import { verificarSesion } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("ingestors")
    .select("id, name, source_type, status, created_at, updated_at")
    .eq("company_id", sesion.company_id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { name, source_type } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "name es requerido" }, { status: 400 });
  }

  const contract = { name: name.trim(), source_type: source_type ?? "csv", config: {} };

  const { data, error } = await supabase
    .from("ingestors")
    .insert({
      name: name.trim(),
      contract,
      status: "inactive",
      company_id: sesion.company_id,
    })
    .select()
    .single();

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data, { status: 201 });
}
