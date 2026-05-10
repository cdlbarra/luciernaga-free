"use client";
import { useEffect, useState, type CSSProperties } from "react";

type IngestorData = {
  id: string;
  name: string;
  source_type: string;
  status: string;
  created_at: string;
  quality_score: number | null;
  columns: string[];
  record_count: number;
  errors: unknown[];
  last_run: string | null;
};

type Props = {
  id: string;
  onClose: () => void;
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0.5rem 0",
  borderBottom: "1px solid #2a2a2a",
  fontSize: 14,
};

const label: CSSProperties = { color: "#aaa" };
const value: CSSProperties = { color: "#f0f0f0", fontWeight: 500 };

export function IngestorDetail({ id, onClose }: Props) {
  const [data, setData] = useState<IngestorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ingestors/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "2rem", width: "100%", maxWidth: 480, color: "#f0f0f0", maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, color: "#facc15", fontSize: 18 }}>
            {loading ? "Cargando…" : (data?.name ?? "Detalle")}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {loading && <p style={{ color: "#666", textAlign: "center" }}>Cargando datos…</p>}
        {error && <p style={{ color: "#f87171" }}>{error}</p>}

        {data && (
          <>
            <section style={{ marginBottom: "1.5rem" }}>
              <div style={row}>
                <span style={label}>Tipo de fuente</span>
                <span style={value}>{data.source_type ?? "—"}</span>
              </div>
              <div style={row}>
                <span style={label}>Estado</span>
                <span style={{ ...value, color: data.status === "active" ? "#4ade80" : "#f87171" }}>
                  {data.status}
                </span>
              </div>
              <div style={row}>
                <span style={label}>Calidad del pipeline</span>
                <span style={{ ...value, color: qualityColor(data.quality_score) }}>
                  {data.quality_score !== null ? `${data.quality_score}/100` : "Sin datos"}
                </span>
              </div>
              <div style={row}>
                <span style={label}>Último procesamiento</span>
                <span style={value}>
                  {data.last_run ? new Date(data.last_run).toLocaleString("es-CL") : "Nunca"}
                </span>
              </div>
              <div style={{ ...row, borderBottom: "none" }}>
                <span style={label}>Registros procesados</span>
                <span style={value}>{data.record_count.toLocaleString("es-CL")}</span>
              </div>
            </section>

            <section style={{ marginBottom: "1.5rem" }}>
              <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 0.5rem" }}>
                Columnas detectadas ({data.columns.length})
              </p>
              {data.columns.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.columns.map(col => (
                    <span key={col} style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 4, padding: "2px 8px", fontSize: 12, color: "#d0d0d0", fontFamily: "monospace" }}>
                      {col}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>Sin columnas detectadas aún</p>
              )}
            </section>

            <section>
              <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 0.5rem" }}>
                Errores del pipeline ({data.errors.length})
              </p>
              {data.errors.length > 0 ? (
                <ul style={{ margin: 0, padding: "0 0 0 1.2rem" }}>
                  {data.errors.map((err, i) => (
                    <li key={i} style={{ color: "#f87171", fontSize: 13, marginBottom: 4 }}>
                      {typeof err === "string" ? err : JSON.stringify(err)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#4ade80", fontSize: 13, margin: 0 }}>Sin errores detectados</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function qualityColor(score: number | null): string {
  if (score === null) return "#aaa";
  if (score >= 80) return "#4ade80";
  if (score >= 50) return "#facc15";
  return "#f87171";
}
