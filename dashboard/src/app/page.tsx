"use client";
import { useState, useEffect } from "react";

type RawDataRow = {
  id: string;
  ingestor_id: string;
  uploaded_by: string;
  company: string;
  data_type: string;
  uploaded_at: string;
  record_count: number;
};

import { IngestorModal } from "@/components/IngestorModal";
import { IngestorDetail } from "@/components/IngestorDetail";
import { IngestorStatus } from "@/components/IngestorStatus";
import { ChatPanel } from "@/components/ChatPanel";

export default function Home() {
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [rawFilter, setRawFilter] = useState({ uploaded_by: "", company: "" });
  const [selectedRawIds, setSelectedRawIds] = useState<Set<string>>(new Set());
  const [rawOptions, setRawOptions] = useState<{ users: string[]; companies: string[] }>({ users: [], companies: [] });

  useEffect(() => {
    fetch("/api/publish").then(r => r.json()).then(setIngestors).catch(() => {});
    fetchRawData({});
    fetch("/api/raw-data?getOptions=true")
      .then(r => r.json())
      .then(d => setRawOptions(d))
      .catch(() => {});
  }, []);

  async function fetchRawData(filter: { uploaded_by?: string; company?: string }) {
    const params = new URLSearchParams();
    if (filter.uploaded_by) params.set("uploaded_by", filter.uploaded_by);
    if (filter.company) params.set("company", filter.company);
    const res = await fetch(`/api/raw-data?${params}`);
    const data = await res.json();
    setRawData(Array.isArray(data) ? data : []);
    setSelectedRawIds(new Set());
  }

  function toggleRawId(id: string) {
    setSelectedRawIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllRaw() {
    setSelectedRawIds(prev =>
      prev.size === rawData.length ? new Set() : new Set(rawData.map(r => r.id))
    );
  }

  async function downloadExport(format: "csv" | "excel") {
    const ids = Array.from(selectedRawIds);
    if (!ids.length) return;
    const res = await fetch(`/api/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const blob = new Blob(
      [format === "csv" ? await res.text() : await res.arrayBuffer()],
      { type: format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw_data_${Date.now()}.${format === "csv" ? "csv" : "xlsx"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedIngestor = ingestors.find(i => i.id === selectedId);

  return (
    <div style={{ display: "flex", gap: "1.5rem", maxWidth: 1280, margin: "0 auto", alignItems: "flex-start" }}>

      {/* ── COLUMNA PRINCIPAL ── */}
      <main style={{ flex: "1 1 0", minWidth: 0 }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <h1 style={{ color: "#facc15", margin: 0, flex: "1 1 auto" }}>🪲 Luciérnaga</h1>
          <button
            onClick={() => setShowListModal(true)}
            style={{ padding: "0.45rem 1rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            Ver ingestiones{ingestors.length > 0 ? ` (${ingestors.length})` : ""}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ padding: "0.45rem 1rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}
          >
            + Ingestor
          </button>
        </div>

        {status && (
          <p style={{ color: status.startsWith("✓") ? "#4ade80" : "#f87171", margin: "0 0 1rem", fontSize: 14 }}>
            {status}
          </p>
        )}

        <IngestorStatus />

        {/* ── RAW DATA ── */}
        <section style={{ marginBottom: "2rem" }}>
          <h2>Raw Data</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
            <select
              value={rawFilter.uploaded_by}
              onChange={e => setRawFilter(f => ({ ...f, uploaded_by: e.target.value }))}
              style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", fontSize: 13, cursor: "pointer" }}
            >
              <option value="">Todos los usuarios</option>
              {rawOptions.users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={rawFilter.company}
              onChange={e => setRawFilter(f => ({ ...f, company: e.target.value }))}
              style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", fontSize: 13, cursor: "pointer" }}
            >
              <option value="">Todas las empresas</option>
              {rawOptions.companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => fetchRawData(rawFilter)}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 13 }}
            >
              Filtrar
            </button>
            <button
              onClick={() => { setRawFilter({ uploaded_by: "", company: "" }); fetchRawData({}); }}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
            >
              Limpiar
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => downloadExport("csv")}
                disabled={selectedRawIds.size === 0}
                style={{ padding: "0.4rem 0.9rem", borderRadius: 6, border: "none", background: selectedRawIds.size ? "#4ade80" : "#2a2a2a", color: selectedRawIds.size ? "#000" : "#555", fontWeight: "bold", cursor: selectedRawIds.size ? "pointer" : "not-allowed", fontSize: 13 }}
              >
                Descargar CSV
              </button>
              <button
                onClick={() => downloadExport("excel")}
                disabled={selectedRawIds.size === 0}
                style={{ padding: "0.4rem 0.9rem", borderRadius: 6, border: "none", background: selectedRawIds.size ? "#60a5fa" : "#2a2a2a", color: selectedRawIds.size ? "#000" : "#555", fontWeight: "bold", cursor: selectedRawIds.size ? "pointer" : "not-allowed", fontSize: 13 }}
              >
                Descargar Excel
              </button>
            </div>
          </div>

          {rawData.length === 0 ? (
            <p style={{ color: "#555", fontSize: 14 }}>Sin registros en raw_data aún.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #3a3a3a" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: "#aaa", fontWeight: 500, width: 32 }}>
                      <input type="checkbox" checked={selectedRawIds.size === rawData.length && rawData.length > 0} onChange={toggleAllRaw} />
                    </th>
                    {["ID", "Usuario", "Empresa", "Tipo", "Registros", "Subido el"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "#facc15", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? "#1a1a1a" : "#161616", borderBottom: "1px solid #2a2a2a" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="checkbox" checked={selectedRawIds.has(row.id)} onChange={() => toggleRawId(row.id)} />
                      </td>
                      <td style={{ padding: "6px 8px", color: "#888", fontFamily: "monospace", fontSize: 11 }}>{row.id.slice(0, 8)}…</td>
                      <td style={{ padding: "6px 8px", color: "#f0f0f0" }}>{row.uploaded_by}</td>
                      <td style={{ padding: "6px 8px", color: "#f0f0f0" }}>{row.company}</td>
                      <td style={{ padding: "6px 8px", color: "#f0f0f0" }}>{row.data_type}</td>
                      <td style={{ padding: "6px 8px", color: "#4ade80", fontWeight: 600 }}>{row.record_count.toLocaleString("es-CL")}</td>
                      <td style={{ padding: "6px 8px", color: "#aaa", whiteSpace: "nowrap" }}>{new Date(row.uploaded_at).toLocaleString("es-CL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedRawIds.size > 0 && (
                <p style={{ color: "#aaa", fontSize: 12, marginTop: 6 }}>{selectedRawIds.size} registro(s) seleccionado(s)</p>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ── PANEL CHAT ── */}
      <aside style={{ width: 340, flexShrink: 0 }}>
        <ChatPanel
          ingestorId={selectedId}
          ingestorName={selectedIngestor?.name}
          onTransformApplied={() => fetchRawData(rawFilter)}
          onShowIngestors={() => setShowListModal(true)}
        />
      </aside>

      {/* ── MODAL: CREAR INGESTOR ── */}
      {showCreateModal && (
        <IngestorModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(data) => {
            setIngestors(prev => [data as any, ...prev]);
            setStatus("✓ Ingestor registrado");
            setShowCreateModal(false);
          }}
        />
      )}

      {/* ── MODAL: LISTA DE INGESTIONES ── */}
      {showListModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
          onClick={() => setShowListModal(false)}
        >
          <div
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "1.5rem", width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, color: "#facc15", fontSize: 18 }}>
                Mis ingestiones
                {ingestors.length > 0 && (
                  <span style={{ fontSize: 13, color: "#666", marginLeft: 8, fontWeight: 400 }}>
                    ({ingestors.length})
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowListModal(false)}
                style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {ingestors.length === 0 ? (
              <p style={{ color: "#555", fontSize: 14, textAlign: "center", padding: "2rem 0" }}>
                No hay ingestores registrados aún.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {ingestors.map((ing: any) => (
                  <li
                    key={ing.id}
                    onClick={() => {
                      setSelectedId(ing.id === selectedId ? null : ing.id);
                      setShowListModal(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.6rem 0.75rem",
                      background: ing.id === selectedId ? "#1e1e00" : "#111",
                      marginBottom: 6,
                      borderRadius: 6,
                      cursor: "pointer",
                      border: `1px solid ${ing.id === selectedId ? "#facc15" : "#2a2a2a"}`,
                    }}
                    onMouseEnter={e => { if (ing.id !== selectedId) e.currentTarget.style.borderColor = "#444"; }}
                    onMouseLeave={e => { if (ing.id !== selectedId) e.currentTarget.style.borderColor = "#2a2a2a"; }}
                  >
                    <div>
                      <div style={{ color: "#f0f0f0", fontWeight: 600, fontSize: 14 }}>{ing.name}</div>
                      <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                        {ing.source_type} · {ing.status}
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`¿Eliminar "${ing.name}"?`)) return;
                        const res = await fetch(`/api/publish?id=${ing.id}`, { method: "DELETE" });
                        if (res.ok) {
                          setIngestors(prev => prev.filter(i => i.id !== ing.id));
                          if (selectedId === ing.id) setSelectedId(null);
                        }
                      }}
                      style={{ background: "#ef4444", color: "#fff", border: "none", padding: "0.3rem 0.65rem", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: "bold", flexShrink: 0 }}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE INGESTOR ── */}
      {selectedId && (
        <IngestorDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}

    </div>
  );
}
