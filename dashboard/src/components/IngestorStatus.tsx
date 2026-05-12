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

      {/* Ingestors List */}
      {ingestores.length > 0 && (
        <div style={{ background: "#1a1a1a", borderRadius: 8, overflow: "hidden", border: "1px solid #333" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #333", background: "#0a0a0a" }}>
            <h3 style={{ margin: 0, color: "#f0f0f0" }}>Lista de Ingestores</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#111111" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa", fontWeight: 600, fontSize: "0.875rem" }}>
                    Nombre
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa", fontWeight: 600, fontSize: "0.875rem" }}>
                    Tipo
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa", fontWeight: 600, fontSize: "0.875rem" }}>
                    Estado
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa", fontWeight: 600, fontSize: "0.875rem" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {ingestores.map((ing) => (
                  <tr
                    key={ing.id}
                    style={{
                      borderBottom: "1px solid #222",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#151515")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "0.75rem", color: "#f0f0f0" }}>
                      <strong>{ing.nombre || ing.name || "N/A"}</strong>
                    </td>
                    <td style={{ padding: "0.75rem", color: "#aaa", fontSize: "0.875rem" }}>
                      {ing.tipo || ing.source_type || "N/A"}
                    </td>
                    <td style={{ padding: "0.75rem", color: "#aaa", fontSize: "0.875rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.5rem",
                          borderRadius: 4,
                          background: ing.estado === "activo" || ing.status === "active" ? "#10b981" : "#6b7280",
                          color: "#fff",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {ing.estado || ing.status || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        onClick={() => handleEliminar(ing.id)}
                        disabled={eliminando === ing.id}
                        style={{
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          padding: "0.4rem 0.8rem",
                          borderRadius: 4,
                          cursor: eliminando === ing.id ? "not-allowed" : "pointer",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          opacity: eliminando === ing.id ? 0.6 : 1,
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (eliminando !== ing.id) {
                            e.currentTarget.style.background = "#b91c1c";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (eliminando !== ing.id) {
                            e.currentTarget.style.background = "#dc2626";
                          }
                        }}
                      >
                        {eliminando === ing.id ? "Eliminando..." : "🗑️"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
