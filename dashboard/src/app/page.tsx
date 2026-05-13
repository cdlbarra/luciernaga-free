"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type RawDataRow = {
  id: string;
  ingestor_id: string;
  uploaded_by: string;
  company: string;
  data_type: string;
  uploaded_at: string;
  record_count: number;
};
import { MermaidChart } from "@/components/MermaidChart";
import { PipelineFlow } from "@/components/PipelineFlow";
import { IngestorModal } from "@/components/IngestorModal";
import { IngestorDetail } from "@/components/IngestorDetail";
import { IngestorStatus } from "@/components/IngestorStatus";

export default function Home() {
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);
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


  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    if (/diagrama|pipeline|flujo|arquitectura/i.test(input)) setShowPipeline(true);
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.content }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Error al conectar." }]);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ color: "#facc15" }}>🪲 Luciérnaga Dashboard</h1>
      <IngestorStatus />
      <section style={{ marginBottom: "2rem" }}>
        <h2>Ingestores</h2>
        <button onClick={() => setShowModal(true)}
          style={{ background: "#facc15", color: "#000", border: "none", padding: "0.5rem 1rem", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
          + Ingestor
        </button>
        {showModal && (
          <IngestorModal
            onClose={() => setShowModal(false)}
            onSuccess={(data) => {
              setIngestors(prev => [data as any, ...prev]);
              setStatus("✓ Ingestor registrado");
            }}
          />
        )}
        {status && <p style={{ color: status.startsWith("✓") ? "#4ade80" : "#f87171" }}>{status}</p>}
        <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
          {ingestors.map((ing: any) => (
            <li
              key={ing.id}
              onClick={() => setSelectedId(ing.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: "#1a1a1a", marginBottom: 8, borderRadius: 6, cursor: "pointer", border: "1px solid transparent", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#facc15")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
            >
              <span><strong>{ing.name}</strong> — {ing.source_type} — {ing.status}</span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`¿Eliminar el ingestor "${ing.name}"?`)) return;
                  const res = await fetch(`/api/publish?id=${ing.id}`, { method: "DELETE" });
                  if (res.ok) setIngestors(prev => prev.filter(i => i.id !== ing.id));
                }}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "0.3rem 0.75rem", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: "bold", flexShrink: 0 }}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        {selectedId && (
          <IngestorDetail id={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </section>

      {/* ── SECCIÓN RAW DATA ── */}
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

      <section>
        <h2>Asistente IA</h2>
        <div style={{ background: "#1a1a1a", padding: "1rem", borderRadius: 8, minHeight: 150, marginBottom: "1rem" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong style={{ color: m.role === "user" ? "#facc15" : "#4ade80" }}>
                {m.role === "user" ? "Tú" : "IA"}:
              </strong>
              {m.role === "user" ? (
                <span style={{ marginLeft: 4 }}>{m.content}</span>
              ) : (
                <div style={{ marginLeft: 4, lineHeight: 1.6 }}>
                  <ReactMarkdown
                    components={{
                      code({ className, children }) {
                        const lang = /language-(\w+)/.exec(className || "")?.[1];
                        if (lang === "mermaid") {
                          return <MermaidChart chart={String(children).trim()} />;
                        }
                        return <code className={className}>{children}</code>;
                      }
                    }}
                  >{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {messages.length === 0 && <p style={{ color: "#666" }}>Pregunta algo sobre el pipeline…</p>}
        </div>
        {showPipeline && (
          <div style={{ marginBottom: "1rem" }}>
            <PipelineFlow />
          </div>
        )}
        <form onSubmit={handleChat} style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Pregunta al asistente…"
            style={{ flex: 1, padding: "0.5rem", borderRadius: 6, border: "1px solid #333", background: "#1a1a1a", color: "#f0f0f0" }} />
          <button type="submit" style={{ background: "#4ade80", color: "#000", border: "none", padding: "0.5rem 1rem", borderRadius: 6, cursor: "pointer" }}>
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}