"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const supabase = createSupabaseBrowser();

type DbIngestor = {
  id: string;
  nombre: string;
  db_type: string;
  schedule: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_rows_ingested: number | null;
};

const SCHEDULE_LABELS: Record<string, string> = {
  cada_hora: "Cada hora",
  cada_6h: "Cada 6 horas",
  cada_24h: "Cada 24 horas",
};

function estadoColor(estado: string | null): string {
  if (estado === "success") return "#4ade80";
  if (estado === "error") return "#f87171";
  return "#666";
}

export default function DbIngestorsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ingestors, setIngestors] = useState<DbIngestor[]>([]);
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<DbIngestor | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/db-ingestors", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(setIngestors)
      .catch(() => {});
  }, [session]);

  async function ejecutar(ing: DbIngestor) {
    setEjecutando(ing.id);
    setStatus(null);
    try {
      const res = await fetch(`/api/db-ingestors/${ing.id}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✓ "${ing.nombre}" ejecutado — ${data.rows_ingested} filas`);
        setIngestors(prev => prev.map(i =>
          i.id === ing.id
            ? { ...i, last_run_at: new Date().toISOString(), last_run_status: "success", last_rows_ingested: data.rows_ingested }
            : i
        ));
      } else {
        setStatus(`✗ Error: ${data.detail ?? "fallo al ejecutar"}`);
      }
    } catch {
      setStatus("✗ Error de red al ejecutar");
    } finally {
      setEjecutando(null);
    }
  }

  async function eliminar(ing: DbIngestor) {
    setEliminando(ing.id);
    const res = await fetch(`/api/db-ingestors/${ing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
    if (res.ok) {
      setIngestors(prev => prev.filter(i => i.id !== ing.id));
      setStatus(`✓ "${ing.nombre}" eliminado`);
    } else {
      setStatus("✗ Error al eliminar");
    }
    setEliminando(null);
    setConfirmEliminar(null);
  }

  if (cargando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#666" }}>
        Cargando…
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <h1 style={{ color: "#facc15", margin: 0, flex: "1 1 auto", fontSize: 22 }}>Ingestores de BD</h1>
        <button
          onClick={() => router.push("/")}
          style={{ padding: "0.45rem 0.85rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontSize: "0.9rem" }}
        >
          ← Dashboard
        </button>
        <button
          onClick={() => router.push("/db-ingestors/nuevo")}
          style={{ padding: "0.45rem 1rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}
        >
          + Nuevo ingestor de BD
        </button>
      </div>

      {status && (
        <p style={{ color: status.startsWith("✓") ? "#4ade80" : "#f87171", margin: "0 0 1rem", fontSize: 14 }}>
          {status}
        </p>
      )}

      {ingestors.length === 0 ? (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "3rem 2rem", textAlign: "center", color: "#555" }}>
          <p style={{ margin: "0 0 1rem", fontSize: 15 }}>No hay ingestores de BD todavía.</p>
          <button
            onClick={() => router.push("/db-ingestors/nuevo")}
            style={{ padding: "0.5rem 1.25rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}
          >
            + Nuevo ingestor de BD
          </button>
        </div>
      ) : (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#111", borderBottom: "1px solid #2a2a2a" }}>
                {["Nombre", "Tipo de BD", "Schedule", "Último run", "Estado", "Acciones"].map(col => (
                  <th key={col} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#666", fontWeight: 600 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingestors.map((ing, i) => (
                <tr key={ing.id} style={{ borderBottom: i < ingestors.length - 1 ? "1px solid #222" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem", color: "#f0f0f0", fontWeight: 600 }}>{ing.nombre}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "#aaa" }}>{ing.db_type}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "#aaa" }}>{SCHEDULE_LABELS[ing.schedule] ?? ing.schedule}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "#aaa" }}>
                    {ing.last_run_at
                      ? new Date(ing.last_run_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ color: estadoColor(ing.last_run_status), fontWeight: 600 }}>
                      {ing.last_run_status === "success"
                        ? `✓ ${ing.last_rows_ingested ?? 0} filas`
                        : ing.last_run_status === "error"
                        ? "✗ Error"
                        : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => ejecutar(ing)}
                        disabled={ejecutando === ing.id}
                        style={{ padding: "0.3rem 0.75rem", borderRadius: 5, border: "1px solid #3a3a3a", background: "transparent", color: ejecutando === ing.id ? "#555" : "#aaa", cursor: ejecutando === ing.id ? "default" : "pointer", fontSize: 12 }}
                      >
                        {ejecutando === ing.id ? "Ejecutando…" : "Ejecutar ahora"}
                      </button>
                      <button
                        onClick={() => setConfirmEliminar(ing)}
                        style={{ padding: "0.3rem 0.65rem", borderRadius: 5, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmEliminar && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}
          onClick={() => setConfirmEliminar(null)}
        >
          <div
            style={{ background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 10, padding: "1.75rem", width: "100%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", color: "#f0f0f0", fontSize: 16 }}>¿Eliminar "{confirmEliminar.nombre}"?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#aaa", fontSize: 14, lineHeight: 1.6 }}>
              Se eliminará el ingestor y su configuración. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmEliminar(null)}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminar(confirmEliminar)}
                disabled={!!eliminando}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
              >
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
