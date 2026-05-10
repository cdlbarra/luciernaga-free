"use client";
import { useEffect, useRef } from "react";
import mermaid from "mermaid";

let initialized = false;

export function MermaidChart({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
      initialized = true;
    }
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch((err) => {
      if (ref.current) ref.current.textContent = `Error al renderizar diagrama: ${err.message}`;
    });
  }, [chart]);

  return <div ref={ref} style={{ margin: "1rem 0" }} />;
}
