export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemMessage = {
    role: "system",
    content: "Eres el asistente de Luciérnaga MVP, un pipeline de ingestión de datos con 10 módulos: profiler, cleaner, validator, normalizer, metadata, reporter, notifier, reader, loader y main. Responde en español, de forma concisa y técnica. Estructura siempre tus respuestas con párrafos separados, usa títulos cuando corresponda, y asegúrate de que el contenido sea claro y visualmente organizado. Cuando uses listas, cada elemento debe estar en su propia línea separada con un salto de línea real (\\n) entre cada punto. Nunca escribas varios elementos de una lista en la misma línea. Cada módulo debe aparecer en su propia línea individual."
  };

  const allMessages = [systemMessage, ...messages];

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: allMessages
    })
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
  return Response.json({ content });
}