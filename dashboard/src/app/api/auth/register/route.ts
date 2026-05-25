import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email || !password)
    return Response.json({ error: "Email y contraseña son requeridos" }, { status: 400 });

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return Response.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: name || null })
    .select("id")
    .single();
  if (companyError) return Response.json({ error: companyError.message }, { status: 500 });

  // 3. Crear perfil vinculando usuario y empresa
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, user_id: userId, company_id: company.id, name: name ?? null });
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

  return Response.json({ company_id: company.id });
}
