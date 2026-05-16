"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { MermaidChart } from "@/components/MermaidChart";

type Sugerencia = { tipo: string; campo: string; problema: string; solucion: string };
type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  ingestorId?: string | null;
  ingestorName?: string;
  onShowIngestors?: () => void;
}

const iconPorTipo: Record<string, string> = {
  error: "❌",
  warning: "⚠️",
  suggestion: "💡",
  info: "ℹ️",
};

export function ChatPanel({ ingestorId, ingestorName, onShowIngestors }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [totalRegistros, setTotalRegistros] = useState<number | null>(null);
  const [rawDataId, setRawDataId] = useState<string | null>(null);
  const [transformando, setTransformando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevIngestorIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, cargando]);

  useEffect(() => {
    if (prevIngestorIdRef.current === ingestorId) return;
    prevIngestorIdRef.current = ingestorId;

    setSugerencias([]);
    setTotalRegistros(null);
    setRawDataId(null);

    if (!ingestorId) return;
    cargarSugerencias(ingestorId);
  }, [ingestorId]);

  async function cargarSugerencias(id: string) {
    try {
      const res = await fetch(`/api/suggest/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const sugs: Sugerencia[] = data.sugerencias ?? [];
      const total: number = data.total_registros ?? 0;
      const rdId: string | null = data.raw_data_id ?? null;

      setSugerencias(sugs);
      setTotalRegistros(total);
      setRawDataId(rdId);

      if (sugs.length > 0) {
        const errores = sugs.filter(s => s.tipo === "error");
        const advertencias = sugs.filter(s => s.tipo === "warning");
        const sugestiones = sugs.filter(s => s.tipo === "suggestion");

        let msg = `Analicé los datos de **${ingestorName ?? "este ingestor"}**`;
        if (total) msg += ` (${total.toLocaleString("es-CL")} registros)`;
        msg += ":\n\n";
        errores.forEach(s => { msg += `❌ **${s.campo}**: ${s.problema}\n   → ${s.solucion}\n\n`; });
        advertencias.forEach(s => { msg += `⚠️ **${s.campo}**: ${s.problema}\n   → ${s.solucion}\n\n`; });
        sugestiones.forEach(s => { msg += `💡 **${s.campo}**: ${s.problema}\n   → ${s.solucion}\n\n`; });
        msg += "¿Quieres que aplique las transformaciones?";

        setMessages([{ role: "assistant", content: msg }]);
      } else if (total > 0) {
        setMessages([{
          role: "assistant",
          content: `✅ Los datos de **${ingestorName ?? "este ingestor"}** (${total.toLocaleString("es-CL")} registros) se ven bien. No detecté problemas importantes.`,
        }]);
      }
    } catch {
      // silencioso — el usuario puede igualmente chatear
    }
  }

  async function aplicarTransformacion() {
    if (!ingestorId || !rawDataId) return;
    setTransformando(true);
    try {
      const res = await fetch(`/api/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingestor_id: ingestorId, raw_data_id: rawDataId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ **Transformación aplicada exitosamente.**\n\nTus datos están normalizados y guardados listos para análisis.\n\n¿Quieres explorar algo más?`,
        }]);
        setSugerencias([]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `❌ Error al transformar: ${data.detail ?? "intenta de nuevo."}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Error de conexión. Verifica que el servicio esté disponible." }]);
    }
    setTransformando(false);
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || cargando) return;

    const userMsg: Msg = { role: "user", content: texto };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setCargando(true);

    const context: Record<string, unknown> = {};
    if (ingestorId) context.ingestor_id = ingestorId;
    if (ingestorName) context.ingestor_name = ingestorName;
    if (totalRegistros != null) context.total_registros = totalRegistros;
    if (sugerencias.length) context.sugerencias = sugerencias;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          context: Object.keys(context).length ? context : undefined,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      if (data.show_ingestors_list) onShowIngestors?.();
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar con el asistente." }]);
    }
    setCargando(false);
  }

  const mostrarBotonTransformar = sugerencias.length > 0 && !!rawDataId && !transformando;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 4rem)",
      background: "#111",
      borderRadius: 10,
      border: "1px solid #2a2a2a",
      overflow: "hidden",
      position: "sticky",
      top: "2rem",
    }}>
      {/* Header */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #2a2a2a", background: "#161616", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🪲</span>
          <span style={{ fontWeight: 700, color: "#facc15", fontSize: 14 }}>Luciérnaga IA</span>
        </div>
        {ingestorName && (
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            Contexto: {ingestorName}
            {totalRegistros != null && ` · ${totalRegistros.toLocaleString("es-CL")} registros`}
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <p style={{ color: "#3a3a3a", fontSize: 13, textAlign: "center", marginTop: "3rem", lineHeight: 1.6 }}>
            {ingestorId
              ? "Analizando datos…"
              : "Selecciona un ingestor para\nanálisis automático, o escribe\nuna pregunta sobre tus datos."}
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "90%",
              padding: "0.6rem 0.9rem",
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? "#facc15" : "#1c1c1c",
              color: m.role === "user" ? "#000" : "#e8e8e8",
              fontSize: 13,
              lineHeight: 1.65,
              wordBreak: "break-word",
            }}>
              {m.role === "user" ? (
                <span>{m.content}</span>
              ) : (
                <ReactMarkdown
                  components={{
                    code({ className, children }) {
                      const lang = /language-(\w+)/.exec(className || "")?.[1];
                      if (lang === "mermaid") return <MermaidChart chart={String(children).trim()} />;
                      return (
                        <code style={{ background: "#2a2a2a", padding: "1px 5px", borderRadius: 3, fontSize: 11, fontFamily: "monospace" }}>
                          {children}
                        </code>
                      );
                    },
                    p({ children }) { return <p style={{ margin: "0 0 6px" }}>{children}</p>; },
                    ul({ children }) { return <ul style={{ margin: "4px 0 4px 1.2rem", padding: 0 }}>{children}</ul>; },
                    li({ children }) { return <li style={{ marginBottom: 2 }}>{children}</li>; },
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {cargando && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ padding: "0.6rem 0.9rem", borderRadius: "14px 14px 14px 4px", background: "#1c1c1c", color: "#555", fontSize: 13 }}>
              Analizando…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias compactas */}
      {sugerencias.length > 0 && (
        <div style={{ borderTop: "1px solid #2a2a2a", padding: "0.6rem 1rem", background: "#0d0d0d", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
            {sugerencias.filter(s => s.tipo === "error").length} errores ·{" "}
            {sugerencias.filter(s => s.tipo === "warning").length} advertencias ·{" "}
            {sugerencias.filter(s => s.tipo === "suggestion").length} sugerencias
          </div>
          {mostrarBotonTransformar && (
            <button
              onClick={aplicarTransformacion}
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: 8,
                border: "none",
                background: "#4ade80",
                color: "#000",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ✨ Aplicar transformaciones
            </button>
          )}
          {transformando && (
            <div style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "0.4rem" }}>
              Transformando datos…
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={enviarMensaje}
        style={{ padding: "0.75rem 1rem", borderTop: "1px solid #2a2a2a", display: "flex", gap: 8, background: "#161616", flexShrink: 0 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pregunta sobre tus datos…"
          disabled={cargando}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #2a2a2a",
            background: "#0d0d0d",
            color: "#f0f0f0",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={cargando || !input.trim()}
          style={{
            padding: "0.5rem 0.9rem",
            borderRadius: 8,
            border: "none",
            background: cargando || !input.trim() ? "#1e1e1e" : "#facc15",
            color: cargando || !input.trim() ? "#444" : "#000",
            fontWeight: "bold",
            cursor: cargando || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          →
        </button>
      </form>
    </div>
  );
}
