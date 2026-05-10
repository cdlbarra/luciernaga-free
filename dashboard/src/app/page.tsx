"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { MermaidChart } from "@/components/MermaidChart";
import { PipelineFlow } from "@/components/PipelineFlow";
import { IngestorModal } from "@/components/IngestorModal";

export default function Home() {
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);

  useEffect(() => {
    fetch("/api/publish").then(r => r.json()).then(setIngestors).catch(() => {});
  }, []);


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
        <ul style={{ marginTop: "1rem" }}>
          {ingestors.map((ing: any) => (
            <li key={ing.id} style={{ padding: "0.5rem", background: "#1a1a1a", marginBottom: 8, borderRadius: 6 }}>
              <strong>{ing.name}</strong> — {ing.source_type} — {ing.status}
            </li>
          ))}
        </ul>
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