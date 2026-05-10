"use client";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import { MermaidChart } from "@/components/MermaidChart";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
  });
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
