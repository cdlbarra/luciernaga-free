"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const supabase = createSupabaseBrowser();

const PUERTOS_DEFAULT: Record<string, number> = { postgresql: 5432, mysql: 3306 };

export default function NuevoDbIngestorPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [dbType, setDbType] = useState<"postgresql" | "mysql">("postgresql");
  const [host, setHost] = useState("");
  const [puerto, setPuerto] = useState(5432);
  const [nombreBd, setNombreBd] = useState("");
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [query, setQuery] = useState("");
  const [schedule, setSchedule] = useState("cada_24h");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });
  }, []);

  function handleDbTypeChange(tipo: "postgresql" | "mysql") {
    setDbType(tipo);
    setPuerto(PUERTOS_DEFAULT[tipo]);
  }

  async function probarConexion() {
    setProbando(true);
    setStatus(null);
    setError(null);
    const res = await fetch("/api/db-ingestors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ solo_probar: true, db_type: dbType, host, port: puerto, database: nombreBd, username: usuario, password: contrasena }),
    });
    const data = await res.json();
    if (res.ok) setStatus("✓ Conexión exitosa");
    else setError(data.error ?? "No se pudo conectar");
    setProbando(false);
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/db-ingestors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ nombre, descripcion, db_type: dbType, host, port: puerto, database: nombreBd, username: usuario, password: contrasena, query, schedule }),
    });
    const data = await res.json();
    if (res.ok) router.push("/db-ingestors");
    else setError(data.error ?? "Error al guardar");
    setGuardando(false);
  }

  if (cargando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#666" }}>
        Cargando…
      </div>
    );
  }

  if (!session) { router.push("/"); return null; }

  const inputStyle = { width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #333", background: "#0d0d0d", color: "#f0f0f0", marginTop: 6, boxSizing: "border-box" as const, fontSize: 14 };
  const labelStyle = { display: "block" as const, marginBottom: "1.1rem", fontSize: 13, color: "#aaa" };
  const puedeProbar = !!(host && nombreBd && usuario && contrasena);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
        <h1 style={{ color: "#facc15", margin: 0, flex: "1 1 auto", fontSize: 22 }}>Nuevo ingestor de BD</h1>
        <button
          onClick={() => router.push("/db-ingestors")}
          style={{ padding: "0.45rem 0.85rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: "#facc15", cursor: "pointer", fontSize: "0.9rem" }}
        >
          ← Volver
        </button>
      </div>

      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "1.75rem" }}>
        <form onSubmit={handleGuardar}>
          <label style={labelStyle}>
            Nombre
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="ventas-erp" style={inputStyle} />
          </label>

          <label style={labelStyle}>
            Descripción <span style={{ color: "#555" }}>(opcional)</span>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ventas mensuales desde ERP" style={inputStyle} />
          </label>

          <label style={labelStyle}>
            Tipo de base de datos
            <select value={dbType} onChange={e => handleDbTypeChange(e.target.value as "postgresql" | "mysql")} style={inputStyle}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: "0 1rem" }}>
            <label style={labelStyle}>
              Host
              <input type="text" value={host} onChange={e => setHost(e.target.value)} required placeholder="db.ejemplo.com" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Puerto
              <input type="number" value={puerto} onChange={e => setPuerto(Number(e.target.value))} required style={inputStyle} />
            </label>
          </div>

          <label style={labelStyle}>
            Nombre de la base de datos
            <input type="text" value={nombreBd} onChange={e => setNombreBd(e.target.value)} required placeholder="mi_base" style={inputStyle} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
            <label style={labelStyle}>
              Usuario
              <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)} required placeholder="admin" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Contraseña
              <input type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} required style={inputStyle} />
            </label>
          </div>

          <label style={labelStyle}>
            Query SQL
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              required
              rows={5}
              placeholder={"SELECT * FROM ventas\nWHERE fecha >= CURRENT_DATE - INTERVAL '30 days'"}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
            />
          </label>

          <label style={labelStyle}>
            Frecuencia de ejecución
            <select value={schedule} onChange={e => setSchedule(e.target.value)} style={inputStyle}>
              <option value="cada_hora">Cada hora</option>
              <option value="cada_6h">Cada 6 horas</option>
              <option value="cada_24h">Cada 24 horas</option>
            </select>
          </label>

          {status && <p style={{ color: "#4ade80", fontSize: 13, margin: "0 0 1rem" }}>{status}</p>}
          {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 1rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={probarConexion}
              disabled={probando || !puedeProbar}
              style={{ padding: "0.5rem 1.1rem", borderRadius: 6, border: "1px solid #facc15", background: "transparent", color: probando ? "#555" : "#facc15", cursor: probando || !puedeProbar ? "default" : "pointer", fontSize: 13, opacity: !puedeProbar ? 0.4 : 1 }}
            >
              {probando ? "Probando…" : "Probar conexión"}
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{ padding: "0.5rem 1.25rem", borderRadius: 6, border: "none", background: guardando ? "#a38000" : "#facc15", color: "#000", cursor: guardando ? "default" : "pointer", fontWeight: "bold", fontSize: 13 }}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
