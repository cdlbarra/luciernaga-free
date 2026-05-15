type Sugerencia = { tipo: string; campo: string; problema: string; solucion: string };
type Context = {
  ingestor_id?: string;
  ingestor_name?: string;
  total_registros?: number;
  sugerencias?: Sugerencia[];
};

async function guardarEnSupabase(rol: string, contenido: string) {
  const INGESTOR_URL = process.env.NEXT_PUBLIC_INGESTOR_URL || "http://localhost:8000";
  try {
    await fetch(`${INGESTOR_URL}/chat/guardar-mensaje`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: "default", rol, contenido }),
    });
  } catch {
    // best-effort
  }
}

function buildSystemPrompt(context?: Context): string {
  let prompt = `Eres Luciérnaga, tu asistente personal de datos.

Tu objetivo es ayudar personas SIN conocimientos técnicos a:
1. Cargar datos crudos (CSV, Excel, JSON)
2. Obtener datos limpios y listos para usar
3. Explorar y entender sus datos

IMPORTANTE: Habla simple, amigable, SIN jerga técnica.

Si el usuario pregunta sobre CARGAR, SUBIR, INGESTAR datos:
- Explica paso a paso y SUGIERE el botón 'Crear nueva ingesta'
- Ejemplo: "Perfecto! Para cargar tu CSV: 1) Click en '+ Ingestor' 2) Dale un nombre 3) Sube el archivo"

Si pregunta sobre CÓMO FUNCIONA:
- Responde simple sin tecnicismos
- No menciones "módulos", "pipelines", "reader"

Si pregunta sobre TRANSFORMACIONES o ANÁLISIS:
- Explica qué hace Luciérnaga (limpia, normaliza, detecta errores)

Siempre responde EN ESPAÑOL, corto y directo (máx 3-4 líneas por mensaje).`;

  if (context?.ingestor_name) {
    prompt += `\n\nDatos cargados actualmente: "${context.ingestor_name}"`;
    if (context.total_registros != null) {
      prompt += ` (${context.total_registros.toLocaleString("es-CL")} registros)`;
    }
  }

  if (context?.sugerencias?.length) {
    const errores = context.sugerencias.filter(s => s.tipo === "error");
    const advertencias = context.sugerencias.filter(s => s.tipo === "warning");
    const sugestiones = context.sugerencias.filter(s => s.tipo === "suggestion");

    prompt += `\n\nProblemas encontrados en los datos:`;
    errores.forEach(s => { prompt += `\n- ❌ "${s.campo}": ${s.problema} → ${s.solucion}`; });
    advertencias.forEach(s => { prompt += `\n- ⚠️ "${s.campo}": ${s.problema} → ${s.solucion}`; });
    sugestiones.forEach(s => { prompt += `\n- 💡 "${s.campo}": ${s.problema} → ${s.solucion}`; });
    prompt += `\n\nSi el usuario quiere corregir los datos, dile que use el botón "✨ Aplicar transformaciones".`;
  }

  return prompt;
}

const LISTA_REGEX =
  /\b(ver|muestra|muéstrame|lista|dame|quiero\s+ver|cuáles\s+son|cuales\s+son)\b.{0,30}\b(ingest(ores?|iones?|as?)|cargas?|datos)\b|\b(mis\s+)?(ingest(ores?|iones?|as?)|cargas?)\b/i;

export async function POST(req: Request) {
  const { messages, context } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    context?: Context;
  };

  const userMessage = messages[messages.length - 1]?.content ?? "";
  const show_ingestors_list = LISTA_REGEX.test(userMessage);

  if (userMessage) await guardarEnSupabase("user", userMessage);

  const systemContent = buildSystemPrompt(context);

  // LLaMA 3 via HF router ignora el system role en multi-turno.
  // Inyectamos el prompt directamente en el primer mensaje de usuario.
  const [first, ...rest] = messages;
  const messagesForAPI = first
    ? [
        {
          role: "user" as const,
          content: `${systemContent}\n\n---\n\n${first.content}`,
        },
        ...rest,
      ]
    : [{ role: "user" as const, content: systemContent }];

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: messagesForAPI,
    }),
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
  const content = raw.replace(/(\d+)\.\s+/g, "\n\n$1. ");

  await guardarEnSupabase("assistant", content);

  return Response.json({ content, show_ingestors_list });
}
