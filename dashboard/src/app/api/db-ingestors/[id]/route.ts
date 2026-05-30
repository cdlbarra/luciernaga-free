import { createClient } from "@supabase/supabase-js";
import { verificarSesion } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const sesion = await verificarSesion(req);
  if (!sesion) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await context.params;

  const { error } = await supabase
    .from("db_ingestors")
    .delete()
    .eq("id", id)
    .eq("company_id", sesion.company_id);

  if (error) return Response.json({ error }, { status: 500 });
  return new Response(null, { status: 204 });
}
