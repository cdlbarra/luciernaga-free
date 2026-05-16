"use client";
import { useState, useEffect } from "react";

import { IngestorModal } from "@/components/IngestorModal";
import { IngestorDetail } from "@/components/IngestorDetail";
import { ChatPanel } from "@/components/ChatPanel";

export default function Home() {
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/publish").then(r => r.json()).then(setIngestors).catch(() => {});
  }, []);

  const selectedIngestor = ingestors.find(i => i.id === selectedId);

  return (
    <div style={{ display: "flex", gap: "1.5rem", maxWidth: 1280, margin: "0 auto", alignItems: "flex-start" }}>

      {/* ── COLUMNA PRINCIPAL ── */}
      <main style={{ flex: "1 1 0", minWidth: 0 }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <h1 style={{ color: "#facc15", margin: 0, flex: "1 1 auto" }}>🪲 Luciérnaga</h1>
          <button
            onClick={() => setShowListModal(v => !v)}
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

        {selectedId && (
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "0.75rem 1rem", fontSize: 13, color: "#aaa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              Ingestor activo: <strong style={{ color: "#facc15" }}>{selectedIngestor?.name ?? selectedId}</strong>
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setDetailId(selectedId)}
                style={{ padding: "0.3rem 0.75rem", borderRadius: 5, border: "1px solid #3a3a3a", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 12 }}
              >
                Ver detalle
              </button>
              <button
                onClick={() => setSelectedId(null)}
                style={{ padding: "0.3rem 0.75rem", borderRadius: 5, border: "none", background: "#2a2a2a", color: "#aaa", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── PANEL CHAT ── */}
      <aside style={{ width: 340, flexShrink: 0 }}>
        <ChatPanel
          ingestorId={selectedId}
          ingestorName={selectedIngestor?.name}
          onShowIngestors={() => setShowListModal(v => !v)}
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.6rem 0.75rem",
                      background: ing.id === selectedId ? "#1e1e00" : "#111",
                      marginBottom: 6,
                      borderRadius: 6,
                      border: `1px solid ${ing.id === selectedId ? "#facc15" : "#2a2a2a"}`,
                    }}
                  >
                    <div
                      style={{ flex: 1, cursor: "pointer" }}
                      onClick={() => {
                        setSelectedId(ing.id === selectedId ? null : ing.id);
                        setShowListModal(false);
                      }}
                    >
                      <div style={{ color: "#f0f0f0", fontWeight: 600, fontSize: 14 }}>{ing.name}</div>
                      <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                        {ing.source_type} · {ing.status}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { setDetailId(ing.id); setShowListModal(false); }}
                        style={{ background: "transparent", color: "#aaa", border: "1px solid #3a3a3a", padding: "0.3rem 0.65rem", borderRadius: 5, cursor: "pointer", fontSize: 12 }}
                      >
                        Detalle
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: ing.id, name: ing.name }); }}
                        style={{ background: "#ef4444", color: "#fff", border: "none", padding: "0.3rem 0.65rem", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE INGESTOR ── */}
      {detailId && (
        <IngestorDetail id={detailId} onClose={() => setDetailId(null)} />
      )}

      {/* ── MODAL: CONFIRMAR ELIMINACIÓN ── */}
      {confirmDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{ background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 10, padding: "1.75rem", width: "100%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", color: "#f0f0f0", fontSize: 16 }}>¿Eliminar "{confirmDelete.name}"?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#aaa", fontSize: 14, lineHeight: 1.6 }}>
              ¿Estás seguro? Se eliminarán el ingestor y todos sus datos asociados. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const res = await fetch(`/api/publish?id=${confirmDelete.id}`, { method: "DELETE" });
                  if (res.ok) {
                    setIngestors(prev => prev.filter(i => i.id !== confirmDelete.id));
                    if (selectedId === confirmDelete.id) setSelectedId(null);
                  }
                  setConfirmDelete(null);
                }}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
