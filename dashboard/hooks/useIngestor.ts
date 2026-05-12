import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_INGESTOR_URL || 'http://localhost:8000';

export function useIngestor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listarIngestores = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/ingestores`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const obtenerIngestor = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/ingestores/${id}`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const eliminarIngestor = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/ingestores/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const guardarMensajeChat = async (
    rol: string,
    contenido: string,
    usuarioId: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/chat/guardar-mensaje`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol, contenido, usuario_id: usuarioId }),
      });
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const obtenerHistorialChat = async (usuarioId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/chat/historial/${usuarioId}`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    checkHealth,
    listarIngestores,
    obtenerIngestor,
    eliminarIngestor,
    guardarMensajeChat,
    obtenerHistorialChat,
  };
}
