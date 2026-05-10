"use client";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";

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
            {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
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
