export async function POST(req: Request) {
  const { messages } = await req.json();
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = `Recibí tu pregunta: "${last}". El pipeline tiene 10 módulos activos corriendo en Render.`;
  return Response.json({ content: reply });
}