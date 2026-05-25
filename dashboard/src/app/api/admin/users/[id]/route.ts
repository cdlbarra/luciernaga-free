import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verificarAdmin(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("user_id", user.id).single();
  return data?.is_admin === true;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await verificarAdmin(req)))
    return Response.json({ error: "No autorizado" }, { status: 403 });

  const { id } = params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", id)
    .maybeSingle();

  if (profile?.company_id) {
    await supabase.from("profiles").delete().eq("user_id", id);
    await supabase.from("companies").delete().eq("id", profile.company_id);
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
