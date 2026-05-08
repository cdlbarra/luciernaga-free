"use client";
import { useState } from "react";
import { publicar } from "@/lib/publish";

export function IngestorButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleAdd() {
    setLoading(true);
    try {
      const contrato = {
        name: `ingestor-${Date.now()}`,
        source_type: "json",
        config: {},
      };
      await publicar(contrato);
      setStatus("✓ Ingestor registrado");
    } catch {
      setStatus("✗ Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleAdd} disabled={loading}>
        {loading ? "Registrando…" : "+ Ingestor"}
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}
