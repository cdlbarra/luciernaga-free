"use client";
import { useState, useRef, type CSSProperties, type FormEvent } from "react";

type Props = {
  onClose: () => void;
  onSuccess: (data: Record<string, unknown>) => void;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#0d0d0d",
  color: "#f0f0f0",
  marginTop: 6,
  boxSizing: "border-box",
  fontSize: 14,
};

export function IngestorModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("json");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    if (!file) { setError("Debes seleccionar un archivo"); return; }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("source_type", sourceType);
      formData.append("file", file);
      const res = await fetch("/api/publish", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      onSuccess(data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "2rem", width: "100%", maxWidth: 420, color: "#f0f0f0" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 1.5rem", color: "#facc15", fontSize: 18 }}>Nuevo Ingestor</h3>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: "1.2rem" }}>
            <span style={{ fontSize: 13, color: "#aaa" }}>Nombre</span>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="mi-ingestor"
              autoFocus
            />
          </label>
          <label style={{ display: "block", marginBottom: "1.2rem" }}>
            <span style={{ fontSize: 13, color: "#aaa" }}>Tipo de fuente</span>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={sourceType}
              onChange={e => setSourceType(e.target.value)}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: "1.2rem" }}>
            <span style={{ fontSize: 13, color: "#aaa" }}>Archivo</span>
            <input
              ref={fileRef}
              style={{ ...inputStyle, paddingTop: "0.4rem" }}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 1rem" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 14 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "0.5rem 1.2rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", fontSize: 14, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Enviando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
