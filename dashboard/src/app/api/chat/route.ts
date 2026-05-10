export async function POST(req: Request) {
  const { messages } = await req.json();

  const history = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const last = history.pop();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "Eres el asistente de Luciérnaga MVP, un pipeline de ingestión de datos con 10 módulos: profiler, cleaner, validator, normalizer, metadata, reporter, notifier, reader, loader y main. Responde en español, de forma concisa y técnica." }]
        },
        contents: [...history, last],
      }),
    }
  );

  const data = await res.json();
  console.log("Gemini response:", JSON.stringify(data));
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
  return Response.json({ content });
}