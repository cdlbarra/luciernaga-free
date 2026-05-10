export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemMessage = {
    role: "system",
    content: "Eres el asistente de Luciérnaga MVP, un pipeline de ingestión de datos con 10 módulos: profiler, cleaner, validator, normalizer, metadata, reporter, notifier, reader, loader y main. Responde en español, de forma concisa y técnica."
  };

  const allMessages = [systemMessage, ...messages];

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistralai/Mistral-7B-Instruct-v0.3",
      messages: allMessages
    })
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
  return Response.json({ content });
}