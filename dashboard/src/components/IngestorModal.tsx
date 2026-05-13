"use client";
import { useState, useRef, useEffect, type CSSProperties, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { generarReportValidacion, type ValidationReport } from "@/lib/dataValidator";

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
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setValidationReport(null); return; }
    setValidating(true);
    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        let rows: Record<string, unknown>[] = [];
        if (sourceType === "json") {
          const json = JSON.parse(new TextDecoder().decode(buffer));
          rows = Array.isArray(json) ? json : Array.isArray(json.rows) ? json.rows : [];
        } else {
          const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        }
        setValidationReport(generarReportValidacion(rows));
      } catch {
        setValidationReport(null);
      } finally {
        setValidating(false);
      }
    })();
  }, [file, sourceType]);

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
          {validating && <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 0.75rem" }}>Validando archivo…</p>}

          {validationReport && (
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: 13 }}>
              <p style={{ margin: "0 0 0.5rem", color: "#aaa" }}>
                Resumen de validación — {validationReport.total_filas} filas · {validationReport.resumen.porcentaje_completitud}% completitud
              </p>
              {validationReport.errores.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {validationReport.errores.map((e, i) => (
                    <p key={i} style={{ margin: "2px 0", color: "#f87171" }}>✗ [{e.campo}] {e.mensaje}</p>
                  ))}
                </div>
              )}
              {validationReport.advertencias.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {validationReport.advertencias.map((w, i) => (
                    <p key={i} style={{ margin: "2px 0", color: "#facc15" }}>⚠ [{w.campo}] {w.mensaje}</p>
                  ))}
                </div>
              )}
              {validationReport.sugerencias.length > 0 && (
                <div>
                  {validationReport.sugerencias.map((s, i) => (
                    <p key={i} style={{ margin: "2px 0", color: "#4ade80" }}>ℹ [{s.campo}] {s.mensaje}</p>
                  ))}
                </div>
              )}
              {!validationReport.resumen.tiene_errores && !validationReport.resumen.tiene_advertencias && (
                <p style={{ margin: 0, color: "#4ade80" }}>✓ Sin problemas detectados</p>
              )}
            </div>
          )}

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
              disabled={loading || validating || (validationReport?.resumen.tiene_errores ?? false)}
              title={validationReport?.resumen.tiene_errores ? "Corrige los errores antes de continuar" : undefined}
              style={{ padding: "0.5rem 1.2rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", fontWeight: "bold", cursor: (loading || validating || validationReport?.resumen.tiene_errores) ? "not-allowed" : "pointer", fontSize: 14, opacity: (loading || validating || validationReport?.resumen.tiene_errores) ? 0.5 : 1 }}
            >
              {loading ? "Enviando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
