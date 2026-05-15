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
  let prompt = `Eres Luciérnaga, asistente de datos para personas sin conocimientos técnicos.

Tu rol:
- Ayudar a entender qué problemas tienen los datos
- Explicar transformaciones de forma simple y amigable
- Sugerir soluciones claras antes de aplicar cambios
- Responder preguntas sobre el pipeline de datos

Reglas de estilo:
- Habla en español, tono amigable. Sin jerga técnica.
- Sé específico: menciona nombres de campos y cantidades reales cuando los tengas.
- Usa listas con saltos de línea separados para mayor claridad.
- Nunca escribas múltiples puntos en la misma línea.`;

  if (context?.ingestor_name) {
    prompt += `\n\nIngestor activo: "${context.ingestor_name}"`;
    if (context.total_registros != null) {
      prompt += ` · ${context.total_registros.toLocaleString("es-CL")} registros`;
    }
  }

  if (context?.sugerencias?.length) {
    const errores = context.sugerencias.filter(s => s.tipo === "error");
    const advertencias = context.sugerencias.filter(s => s.tipo === "warning");
    const sugestiones = context.sugerencias.filter(s => s.tipo === "suggestion");

    prompt += `\n\nProblemas detectados en los datos actuales:`;
    errores.forEach(s => { prompt += `\n- ❌ Error en "${s.campo}": ${s.problema} → ${s.solucion}`; });
    advertencias.forEach(s => { prompt += `\n- ⚠️ Advertencia en "${s.campo}": ${s.problema} → ${s.solucion}`; });
    sugestiones.forEach(s => { prompt += `\n- 💡 Sugerencia en "${s.campo}": ${s.problema} → ${s.solucion}`; });
    prompt += `\n\nEl usuario puede aplicar las transformaciones con el botón "✨ Aplicar transformaciones". Si el usuario pregunta si puede proceder o dice "sí", confirma que puede usar ese botón.`;
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

  const systemMessage = { role: "system", content: buildSystemPrompt(context) };
  const allMessages = [systemMessage, ...messages];

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: allMessages,
    }),
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
  const content = raw.replace(/(\d+)\.\s+/g, "\n\n$1. ");

  await guardarEnSupabase("assistant", content);

  return Response.json({ content, show_ingestors_list });
}
