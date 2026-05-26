import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verificarSesion } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
  const sesion = await verificarSesion(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const ingestor_id = req.nextUrl.searchParams.get('ingestor_id');
  if (!ingestor_id) {
    return NextResponse.json({ error: 'ingestor_id requerido' }, { status: 400 });
  }

  const { data: ingestor } = await supabase
    .from('ingestors')
    .select('id')
    .eq('id', ingestor_id)
    .eq('company_id', sesion.company_id)
    .single();

  if (!ingestor) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('id, status, created_at, rows_processed, error_message')
    .eq('ingestor_id', ingestor_id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
