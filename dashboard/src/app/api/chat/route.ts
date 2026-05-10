export async function POST(req: Request) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "GET",
    }
  );

  const data = await res.json();
  return Response.json(data);
}