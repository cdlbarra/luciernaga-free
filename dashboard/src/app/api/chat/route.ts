type Sugerencia = { tipo: string; campo: string; problema: string; solucion: string };
type Context = {
  ingestor_id?: string;
  ingestor_name?: string;
  total_registros?: number;
  sugerencias?: Sugerencia[];
  data_preview?: string;
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
  const hasData = !!(context?.data_preview);

  let prompt = `Eres Luciérnaga, asistente personal de datos. Habla siempre en español, de forma simple, amigable y SIN jerga técnica.`;

  if (hasData) {
    prompt += `

MODO ANÁLISIS ACTIVO: El usuario tiene datos reales cargados. Tu trabajo es analizarlos y responder con insights concretos.

REGLAS para este modo:
- Calcula y menciona promedios, totales, máximos, mínimos cuando sean relevantes.
- Identifica patrones, tendencias o anomalías visibles en los datos.
- Responde directamente con números reales extraídos de los datos proporcionados.
- NO describas el esquema ni los tipos de columnas a menos que el usuario lo pida explícitamente.
- NO digas "los datos muestran columnas de tipo..." ni "el dataset contiene campos...".
- Si el usuario pregunta "¿cuánto?", "¿cuál es el total?", "¿qué área tiene más?", responde con el número real.
- Sé conciso: máx 4-5 líneas por respuesta, prioriza los números más relevantes.`;
  } else {
    prompt += `

Tu objetivo es ayudar a personas SIN conocimientos técnicos a:
1. Cargar datos crudos (CSV, Excel, JSON)
2. Obtener datos limpios y listos para usar
3. Explorar y entender sus datos

Si el usuario pregunta sobre CARGAR, SUBIR, INGESTAR datos:
- Explica paso a paso y sugiere el botón '+ Ingestor'
- Ejemplo: "Para cargar tu CSV: 1) Toca '+ Ingestor' 2) Dale un nombre 3) Sube el archivo"

Si pregunta sobre CÓMO FUNCIONA:
- Responde simple, sin mencionar "módulos", "pipelines" ni "reader"

Siempre responde en español, corto y directo (máx 3-4 líneas por mensaje).`;
  }

  if (context?.ingestor_name) {
    prompt += `\n\nIngestor activo: "${context.ingestor_name}"`;
    if (context.total_registros != null) {
      prompt += ` — ${context.total_registros.toLocaleString("es-CL")} registros en total.`;
    }
  }

  if (context?.data_preview) {
    prompt += `\n\nDAtos disponibles para análisis:\n${context.data_preview}`;
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

  const messagesForAPI = [
    { role: "system" as const, content: systemContent },
    ...messages,
  ];

  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "command-r-08-2024",
      messages: messagesForAPI,
    }),
  });

  const data = await res.json();
  const raw = data.message?.content?.[0]?.text ?? JSON.stringify(data);
  const content = raw.replace(/(\d+)\.\s+/g, "\n\n$1. ");

  await guardarEnSupabase("assistant", content);

  return Response.json({ content, show_ingestors_list });
}
