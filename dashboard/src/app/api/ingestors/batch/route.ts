import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function DELETE(req: Request) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Se requiere un array de ids" }, { status: 400 });
  }

  const { error } = await supabase.from("ingestors").delete().in("id", ids);
  if (error) return Response.json({ error }, { status: 500 });

  return new Response(null, { status: 204 });
}
