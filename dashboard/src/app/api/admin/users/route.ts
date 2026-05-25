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

export async function GET(req: Request) {
  if (!(await verificarAdmin(req)))
    return Response.json({ error: "No autorizado" }, { status: 403 });

  const [{ data: { users } }, { data: profiles }, { data: companies }] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("user_id, name, company_id"),
    supabase.from("companies").select("id, name"),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
  const companyMap = Object.fromEntries((companies ?? []).map(c => [c.id, c.name]));

  const result = (users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: profileMap[u.id]?.name ?? null,
    company: companyMap[profileMap[u.id]?.company_id] ?? null,
    created_at: u.created_at,
  }));

  return Response.json(result);
}
