"use client";
import { useState, useEffect } from "react";
import { useIngestor } from "@/hooks/useIngestor";

interface Ingestor {
  id: string;
  nombre?: string;
  name?: string;
  tipo?: string;
  source_type?: string;
  estado?: string;
  status?: string;
}

export function IngestorStatus() {
  const { checkHealth, listarIngestores, eliminarIngestor, cargando } = useIngestor();
  const [ingestores, setIngestores] = useState<Ingestor[]>([]);
  const [isHealthy, setIsHealthy] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const loadData = async () => {
    try {
      await checkHealth();
      setIsHealthy(true);
    } catch {
      setIsHealthy(false);
    }

    try {
      const list = await listarIngestores();
      setIngestores(Array.isArray(list) ? list : []);
    } catch {
      setIngestores([]);
    }
  };

  const handleEliminar = async (id: string) => {
    if (window.confirm("¿Eliminar este ingestor?")) {
      setEliminando(id);
      try {
        await eliminarIngestor(id);
        await loadData();
      } catch (err) {
        console.error("Error al eliminar ingestor:", err);
      } finally {
        setEliminando(null);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <section style={{ marginBottom: "2rem", marginTop: "2rem" }}>
      <h2 style={{ color: "#facc15", marginBottom: "1rem" }}>Estado de Conexión</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Ingestor Status */}
        <div style={{
          background: "#1a1a1a",
          border: `2px solid ${isHealthy ? "#4ade80" : "#f87171"}`,
          borderRadius: 8,
          padding: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: 20 }}>{isHealthy ? "✅" : "❌"}</span>
            <h3 style={{ margin: 0, color: "#f0f0f0" }}>Ingestor</h3>
          </div>
          <p style={{ margin: "0.5rem 0", color: "#aaa", fontSize: "0.875rem" }}>
            {isHealthy ? "Activo" : "Inactivo"}
          </p>
        </div>

        {/* Ingestors Count */}
        <div style={{
          background: "#1a1a1a",
          border: "2px solid #facc15",
          borderRadius: 8,
          padding: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <h3 style={{ margin: 0, color: "#f0f0f0" }}>Ingestores</h3>
          </div>
          <p style={{ margin: "0.5rem 0", color: "#aaa", fontSize: "0.875rem" }}>
            {ingestores.length} disponibles
          </p>
          <button
            onClick={loadData}
            disabled={cargando}
            style={{
              marginTop: "0.5rem",
              background: "#facc15",
              color: "#000",
              border: "none",
              padding: "0.4rem 0.8rem",
              borderRadius: 4,
              cursor: cargando ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: "bold",
              opacity: cargando ? 0.6 : 1,
            }}
          >
            {cargando ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

    </section>
  );
}
