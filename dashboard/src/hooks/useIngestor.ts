import { useState } from "react";

const INGESTOR_URL = process.env.NEXT_PUBLIC_INGESTOR_URL || "http://localhost:8000";

export function useIngestor() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      setCargando(true);
      const res = await fetch(`${INGESTOR_URL}/health`);
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return null;
    } finally {
      setCargando(false);
    }
  };

  const listarIngestores = async () => {
    try {
      setCargando(true);
      const res = await fetch(`${INGESTOR_URL}/ingestores`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return [];
    } finally {
      setCargando(false);
    }
  };

  const obtenerIngestor = async (id: string) => {
    try {
      setCargando(true);
      const res = await fetch(`${INGESTOR_URL}/ingestores/${id}`);
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return null;
    } finally {
      setCargando(false);
    }
  };

  const eliminarIngestor = async (id: string) => {
    try {
      setCargando(true);
      const res = await fetch(`${INGESTOR_URL}/ingestores/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return null;
    } finally {
      setCargando(false);
    }
  };

  const guardarMensajeChat = async (
    rol: "user" | "assistant",
    contenido: string,
    usuarioId: string = "default"
  ) => {
    try {
      const res = await fetch(`${INGESTOR_URL}/chat/guardar-mensaje`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          rol,
          contenido,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Error guardando mensaje:", err);
      return null;
    }
  };

  const obtenerHistorialChat = async (usuarioId: string = "default") => {
    try {
      setCargando(true);
      const res = await fetch(`${INGESTOR_URL}/chat/historial/${usuarioId}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return [];
    } finally {
      setCargando(false);
    }
  };

  return {
    checkHealth,
    listarIngestores,
    obtenerIngestor,
    eliminarIngestor,
    guardarMensajeChat,
    obtenerHistorialChat,
    cargando,
    error,
  };
}
