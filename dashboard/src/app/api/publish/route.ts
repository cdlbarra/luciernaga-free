import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const contrato = await req.json();
  if (!contrato.name || !contrato.source_type) {
    return Response.json({ error: "Contrato inválido" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("ingestors")
    .insert({ name: contrato.name, contract: contrato, status: "active" })
    .select()
    .single();
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data);
}

export async function GET() {
  const { data } = await supabase
    .from("ingestors")
    .select("*")
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}