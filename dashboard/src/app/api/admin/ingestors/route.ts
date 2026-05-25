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

  const { data: ingestors } = await supabase
    .from("ingestors")
    .select("id, name, created_at, company_id")
    .order("created_at", { ascending: false });

  if (!ingestors?.length) return Response.json([]);

  const companyIds = [...new Set(
    ingestors.map(i => i.company_id).filter((id): id is string => !!id)
  )];

  const [{ data: profiles }, { data: { users } }] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("profiles").select("user_id, company_id").in("company_id", companyIds)
      : Promise.resolve({ data: [] as { user_id: string; company_id: string }[] }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const companyToUser = Object.fromEntries((profiles ?? []).map(p => [p.company_id, p.user_id]));
  const userToEmail = Object.fromEntries((users ?? []).map(u => [u.id, u.email ?? ""]));

  const result = ingestors.map(ing => ({
    id: ing.id,
    name: ing.name,
    created_at: ing.created_at,
    owner_email: ing.company_id
      ? (userToEmail[companyToUser[ing.company_id]] ?? null)
      : null,
  }));

  return Response.json(result);
}
