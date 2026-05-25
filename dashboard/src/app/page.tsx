"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

import { IngestorModal } from "@/components/IngestorModal";
import { IngestorDetail } from "@/components/IngestorDetail";
import { ChatPanel } from "@/components/ChatPanel";

const supabase = createSupabaseBrowser();

export default function Home() {
  const router = useRouter();

  // ── Auth ──
  const [session, setSession] = useState<Session | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Dashboard ──
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Cargar company_id y nombre del perfil cuando hay sesión
  useEffect(() => {
    if (!session) { setCompanyId(null); setProfileName(null); setIsAdmin(false); return; }
    supabase
      .from("profiles")
      .select("company_id, name, is_admin")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => {
        setCompanyId(data?.company_id ?? null);
        setProfileName(data?.name ?? null);
        setIsAdmin(data?.is_admin === true);
      });
  }, [session]);

  // Cargar ingestores cuando hay sesión
  useEffect(() => {
    if (!session) { setIngestors([]); return; }
    fetch("/api/publish", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(r => r.json()).then(setIngestors).catch(() => {});
  }, [session]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: nombre }),
    });
    const data = await res.json();
    if (!res.ok) { setAuthError(data.error); setAuthLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIngestors([]);
    setSelectedId(null);
  }

  const selectedIngestor = ingestors.find(i => i.id === selectedId);

  // ── Cargando sesión ──
  if (sessionLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#666" }}>
        Cargando…
      </div>
    );
  }

  // ── Sin sesión: formulario login/registro ──
  if (!session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "2rem", width: "100%", maxWidth: 380 }}>
          <h2 style={{ color: "#facc15", margin: "0 0 1.75rem", fontSize: 20 }}>🪲 Luciérnaga</h2>
          <form onSubmit={modo === "login" ? handleLogin : handleRegistro}>
            {modo === "registro" && (
              <label style={{ display: "block", marginBottom: "1.1rem" }}>
                <span style={{ fontSize: 13, color: "#aaa" }}>Nombre</span>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  autoFocus
                  style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", marginTop: 6, boxSizing: "border-box", fontSize: 14 }}
                />
              </label>
            )}
            <label style={{ display: "block", marginBottom: "1.1rem" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus={modo === "login"}
                style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", marginTop: 6, boxSizing: "border-box", fontSize: 14 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "1.4rem" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", marginTop: 6, boxSizing: "border-box", fontSize: 14 }}
              />
            </label>
            {authError && (
              <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 1rem" }}>{authError}</p>
            )}
            <button
              type="submit"
              disabled={authLoading}
              style={{ width: "100%", padding: "0.6rem", borderRadius: 6, border: "none", background: "#facc15", color: "#000", fontWeight: "bold", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, opacity: authLoading ? 0.6 : 1 }}
            >
              {authLoading ? "Cargando…" : modo === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 13, color: "#666" }}>
            {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button
              onClick={() => { setModo(modo === "login" ? "registro" : "login"); setAuthError(null); setNombre(""); }}
              style={{ background: "none", border: "none", color: "#facc15", cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              {modo === "login" ? "Registrarse" : "Iniciar sesión"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Dashboard (sesión activa) ──
  return (
    <div style={{ display: "flex", gap: "1.5rem", maxWidth: 1280, margin: "0 auto", alignItems: "flex-start" }}>

      {/* ── COLUMNA PRINCIPAL ── */}
      <main style={{ flex: "1 1 0", minWidth: 0 }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <h1 style={{ color: "#facc15", margin: 0, flex: "1 1 auto" }}>🪲 Luciérnaga</h1>
          <span style={{ fontSize: "1rem", color: "#facc15" }}>{profileName ?? session.user.email!.split("@")[0]}</span>
          <button
            onClick={handleLogout}
            style={{ padding: "0.45rem 0.85rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Cerrar sesión
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              style={{ padding: "0.45rem 0.85rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontSize: "0.9rem" }}
            >
              Panel Admin
            </button>
          )}
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
          ingestors={ingestors}
          onSelectIngestor={setSelectedId}
        />
      </aside>

      {/* ── MODAL: CREAR INGESTOR ── */}
      {showCreateModal && companyId && (
        <IngestorModal
          companyId={companyId}
          accessToken={session.access_token}
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
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 0.25rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#aaa", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={checkedIds.size === ingestors.length && ingestors.length > 0}
                      onChange={e => {
                        if (e.target.checked) setCheckedIds(new Set(ingestors.map(i => i.id)));
                        else setCheckedIds(new Set());
                      }}
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#facc15" }}
                    />
                    Seleccionar todos
                  </label>
                  {checkedIds.size > 0 && (
                    <button
                      onClick={() => setConfirmBatchDelete(true)}
                      style={{ padding: "0.3rem 0.85rem", borderRadius: 5, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
                    >
                      Eliminar seleccionados ({checkedIds.size})
                    </button>
                  )}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {ingestors.map((ing: any) => (
                    <li
                      key={ing.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "0.6rem 0.75rem",
                        background: ing.id === selectedId ? "#1e1e00" : checkedIds.has(ing.id) ? "#1a1a0a" : "#111",
                        marginBottom: 6,
                        borderRadius: 6,
                        border: `1px solid ${ing.id === selectedId ? "#facc15" : checkedIds.has(ing.id) ? "#5a5a00" : "#2a2a2a"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(ing.id)}
                        onChange={e => {
                          setCheckedIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(ing.id);
                            else next.delete(ing.id);
                            return next;
                          });
                        }}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#facc15", flexShrink: 0 }}
                      />
                      <div
                        style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
                        onClick={() => {
                          setSelectedId(ing.id === selectedId ? null : ing.id);
                          setShowListModal(false);
                        }}
                      >
                        <div style={{ color: "#f0f0f0", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.name}</div>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE INGESTOR ── */}
      {detailId && (
        <IngestorDetail id={detailId} onClose={() => setDetailId(null)} accessToken={session.access_token} />
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
                  const res = await fetch(`/api/publish?id=${confirmDelete.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${session!.access_token}` },
                  });
                  if (res.ok) {
                    setIngestors(prev => prev.filter(i => i.id !== confirmDelete.id));
                    setCheckedIds(prev => { const next = new Set(prev); next.delete(confirmDelete.id); return next; });
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

      {/* ── MODAL: CONFIRMAR ELIMINACIÓN BATCH ── */}
      {confirmBatchDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}
          onClick={() => setConfirmBatchDelete(false)}
        >
          <div
            style={{ background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 10, padding: "1.75rem", width: "100%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", color: "#f0f0f0", fontSize: 16 }}>
              ¿Eliminar {checkedIds.size} ingestor{checkedIds.size !== 1 ? "es" : ""}?
            </h3>
            <p style={{ margin: "0 0 1.5rem", color: "#aaa", fontSize: 14, lineHeight: 1.6 }}>
              Se eliminarán {checkedIds.size} ingestor{checkedIds.size !== 1 ? "es" : ""} y todos sus datos asociados. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmBatchDelete(false)}
                disabled={deletingBatch}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                disabled={deletingBatch}
                onClick={async () => {
                  setDeletingBatch(true);
                  try {
                    const ids = Array.from(checkedIds);
                    const res = await fetch("/api/ingestors/batch", {
                      method: "DELETE",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session!.access_token}`,
                      },
                      body: JSON.stringify({ ids }),
                    });
                    if (res.ok) {
                      setIngestors(prev => prev.filter(i => !checkedIds.has(i.id)));
                      if (selectedId && checkedIds.has(selectedId)) setSelectedId(null);
                      setCheckedIds(new Set());
                      setStatus(`✓ ${ids.length} ingestor${ids.length !== 1 ? "es" : ""} eliminado${ids.length !== 1 ? "s" : ""}`);
                    } else {
                      setStatus("✗ Error al eliminar los ingestores");
                    }
                  } finally {
                    setDeletingBatch(false);
                    setConfirmBatchDelete(false);
                  }
                }}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "none", background: deletingBatch ? "#7f1d1d" : "#ef4444", color: "#fff", cursor: deletingBatch ? "default" : "pointer", fontSize: 13, fontWeight: "bold" }}
              >
                {deletingBatch ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
