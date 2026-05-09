export async function POST(req: Request) {
  const { messages } = await req.json();
  const last = messages[messages.length - 1]?.content ?? "";
  // Respuesta simple sin necesitar API key de IA por ahora
  const reply = `Recibí tu pregunta: "${last}". El pipeline tiene 10 módulos activos y está corriendo en Render.`;
  return Response.json({ content: reply });
}
