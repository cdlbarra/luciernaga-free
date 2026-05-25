"use client";
import { CSSProperties, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Usuario = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  created_at: string;
};

type Ingestor = {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
};

type ConfirmDelete = {
  tipo: "usuario" | "ingestor";
  id: string;
  label: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [ingestors, setIngestors] = useState<Ingestor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null);

  useEffect(() => {
    const check = async () => {
      const supabase = createSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        router.push("/");
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [resUsuarios, resIngestors] = await Promise.all([
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/ingestors", { headers }),
      ]);

      if (!resUsuarios.ok || !resIngestors.ok) {
        setError("Error cargando datos del panel");
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      setUsuarios(await resUsuarios.json());
      setIngestors(await resIngestors.json());
      setIsAdmin(true);
      setLoading(false);
    };

    check();
  }, []);

  async function eliminar() {
    if (!confirmDelete) return;
    const supabase = createSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const url = confirmDelete.tipo === "usuario"
      ? `/api/admin/users/${confirmDelete.id}`
      : `/api/admin/ingestors/${confirmDelete.id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      if (confirmDelete.tipo === "usuario")
        setUsuarios(prev => prev.filter(u => u.id !== confirmDelete.id));
      else
        setIngestors(prev => prev.filter(i => i.id !== confirmDelete.id));
    }
    setConfirmDelete(null);
  }

  const thStyle: CSSProperties = {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    color: "#666",
    fontWeight: 600,
    fontSize: 12,
    borderBottom: "1px solid #2a2a2a",
    whiteSpace: "nowrap",
  };
  const tdStyle: CSSProperties = {
    padding: "0.55rem 0.75rem",
    fontSize: 13,
    color: "#d0d0d0",
    borderBottom: "1px solid #1e1e1e",
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#666" }}>
      Cargando…
    </div>
  );

  if (!isAdmin) return null;

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#f87171" }}>
      {error}
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
        <h1 style={{ color: "#facc15", margin: 0, fontSize: 22 }}>🪲 Admin</h1>
        <button
          onClick={() => router.push("/")}
          style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontSize: 13 }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Tabla usuarios */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ color: "#f0f0f0", fontSize: 16, margin: "0 0 1rem", fontWeight: 600 }}>
          Usuarios
          <span style={{ color: "#555", fontWeight: 400, fontSize: 13, marginLeft: 8 }}>({usuarios.length})</span>
        </h2>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Empresa</th>
                <th style={thStyle}>Registrado</th>
                <th style={{ ...thStyle, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#555", padding: "2rem" }}>
                    Sin usuarios
                  </td>
                </tr>
              ) : usuarios.map(u => (
                <tr key={u.id}>
                  <td style={tdStyle}>{u.name ?? <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.company ?? <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString("es-CL")}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setConfirmDelete({ tipo: "usuario", id: u.id, label: u.email ?? u.id })}
                      style={{ padding: "0.25rem 0.6rem", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 12 }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tabla ingestores */}
      <section>
        <h2 style={{ color: "#f0f0f0", fontSize: 16, margin: "0 0 1rem", fontWeight: 600 }}>
          Ingestores
          <span style={{ color: "#555", fontWeight: 400, fontSize: 13, marginLeft: 8 }}>({ingestors.length})</span>
        </h2>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Creado</th>
                <th style={{ ...thStyle, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {ingestors.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#555", padding: "2rem" }}>
                    Sin ingestores
                  </td>
                </tr>
              ) : ingestors.map(ing => (
                <tr key={ing.id}>
                  <td style={tdStyle}>{ing.name}</td>
                  <td style={tdStyle}>{ing.owner_email ?? <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={tdStyle}>{new Date(ing.created_at).toLocaleDateString("es-CL")}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setConfirmDelete({ tipo: "ingestor", id: ing.id, label: ing.name })}
                      style={{ padding: "0.25rem 0.6rem", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 12 }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal confirmación */}
      {confirmDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{ background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 10, padding: "1.75rem", width: "100%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", color: "#f0f0f0", fontSize: 16 }}>
              ¿Eliminar {confirmDelete.tipo}?
            </h3>
            <p style={{ margin: "0 0 1.5rem", color: "#aaa", fontSize: 14, lineHeight: 1.6 }}>
              <strong style={{ color: "#f0f0f0" }}>{confirmDelete.label}</strong>
              {confirmDelete.tipo === "usuario" && " — se eliminará el perfil y la empresa asociada."}{" "}
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
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
