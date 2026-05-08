// publicar() — misma firma que en Cloud Run
export async function publicar(contrato: Record<string, unknown>) {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contrato),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
