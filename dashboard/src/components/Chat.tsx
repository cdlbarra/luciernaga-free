"use client";
import { useState, useEffect } from "react";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import { MermaidChart } from "@/components/MermaidChart";
import { useIngestor } from "@/hooks/useIngestor";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
  });

  const { obtenerHistorialChat, guardarMensajeChat } = useIngestor();
  const [historialCargado, setHistorialCargado] = useState(false);
  const [ultimoMensajeGuardado, setUltimoMensajeGuardado] = useState<string>("");

  // Cargar historial al montar
  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const historial = await obtenerHistorialChat("default");
        if (Array.isArray(historial) && historial.length > 0) {
          // El historial ya está disponible en Railway
          // Los mensajes se sincronizarán automáticamente
        }
      } catch (err) {
        console.error("Error cargando historial:", err);
      }
      setHistorialCargado(true);
    };

    cargarHistorial();
  }, []);

  // Guardar mensajes en Railway cuando cambien
  useEffect(() => {
    if (!historialCargado || messages.length === 0) return;

    const guardarMensajes = async () => {
      // Guardar solo el último mensaje si es nuevo
      const ultimoMensaje = messages[messages.length - 1];

      if (ultimoMensaje && ultimoMensaje.content !== ultimoMensajeGuardado) {
        try {
          await guardarMensajeChat(
            ultimoMensaje.role as "user" | "assistant",
            ultimoMensaje.content,
            "default"
          );
          setUltimoMensajeGuardado(ultimoMensaje.content);
        } catch (err) {
          console.error("Error guardando mensaje:", err);
        }
      }
    };

    guardarMensajes();
  }, [messages, historialCargado, ultimoMensajeGuardado]);

  return (
    <div>
      <div>
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.role === "user" ? "Tú" : "IA"}:</strong>{" "}
            {m.role === "user" ? m.content : (
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
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Pregunta al asistente…" />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
