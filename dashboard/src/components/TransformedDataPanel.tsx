"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type ColumnType = "number" | "date" | "boolean" | "string";

type TransformedDataResponse = {
  rows: Record<string, unknown>[];
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  total: number;
  page: number;
  totalPages: number;
  transformedAt: string | null;
};

const CHART_COLORS = ["#facc15", "#4ade80", "#60a5fa", "#f87171", "#a78bfa", "#fb923c"];

function buildCategoricalData(
  rows: Record<string, unknown>[],
  col: string
): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row[col] ?? "—");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
}

function buildNumericData(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
  xIsDate: boolean,
): { name: string; value: number }[] {
  return rows.slice(0, 50).map((row, i) => {
    const raw = String(row[xCol] ?? i + 1);
    // Si el eje X es fecha ISO (YYYY-MM-DD), mostrar solo MM-DD para que quepan los labels
    const name = xIsDate && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(5) : raw;
    return { name, value: Number(row[yCol] ?? 0) };
  });
}

export function TransformedDataPanel({ ingestorId, accessToken }: { ingestorId: string; accessToken: string }) {
  const [data, setData] = useState<TransformedDataResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/transformed-data?ingestor_id=${ingestorId}&page=${page}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error));
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ingestorId, page, accessToken]);

  if (loading) {
    return (
      <div style={{ padding: "1rem 0", color: "#666", fontSize: 13 }}>
        Cargando datos transformados…
      </div>
    );
  }

  if (error) {
    return <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>;
  }

  if (!data || data.total === 0) {
    return (
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
        <p style={{ color: "#555", fontSize: 14, margin: 0 }}>
          Sin datos transformados aún. Sube un archivo y ejecuta la transformación.
        </p>
      </div>
    );
  }

  const numericCols = data.columns.filter(c => data.columnTypes[c] === "number");
  const dateCols = data.columns.filter(c => data.columnTypes[c] === "date");
  const categoricalCols = data.columns.filter(
    c => data.columnTypes[c] === "string" || data.columnTypes[c] === "boolean"
  );

  const xAxisCol = dateCols[0] ?? data.columns[0];
  const firstNumCol = numericCols[0];
  const firstCatCol = categoricalCols[0];

  const allRows = data.rows;

  return (
    <div>
      {/* Resumen */}
      <div style={{ display: "flex", gap: 12, marginBottom: "1rem", flexWrap: "wrap" }}>
        <StatBadge label="Total filas" value={data.total.toLocaleString("es-CL")} />
        <StatBadge label="Columnas" value={String(data.columns.length)} />
        {numericCols.length > 0 && <StatBadge label="Numéricas" value={String(numericCols.length)} color="#60a5fa" />}
        {dateCols.length > 0 && <StatBadge label="Fechas" value={String(dateCols.length)} color="#4ade80" />}
        {categoricalCols.length > 0 && <StatBadge label="Categóricas" value={String(categoricalCols.length)} color="#a78bfa" />}
      </div>

      {/* Gráfico numérico */}
      {firstNumCol && (
        <ChartSection title={`Distribución: ${firstNumCol}`}>
          <ResponsiveContainer width="100%" height={180}>
            {dateCols.length > 0 ? (
              <LineChart data={buildNumericData(allRows, xAxisCol, firstNumCol, true)}>
                <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #3a3a3a", color: "#f0f0f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#facc15" dot={false} strokeWidth={2} name={firstNumCol} />
              </LineChart>
            ) : (
              <BarChart data={buildNumericData(allRows, xAxisCol, firstNumCol, false)}>
                <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #3a3a3a", color: "#f0f0f0", fontSize: 12 }} />
                <Bar dataKey="value" fill="#facc15" name={firstNumCol} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Gráfico categórico */}
      {firstCatCol && (
        <ChartSection title={`Distribución: ${firstCatCol}`}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={buildCategoricalData(allRows, firstCatCol)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={65}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {buildCategoricalData(allRows, firstCatCol).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #3a3a3a", color: "#f0f0f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#aaa" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Tabla paginada */}
      <div style={{ marginTop: "1rem" }}>
        <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 0.5rem" }}>
          Registros transformados (página {data.page} de {data.totalPages})
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
            <thead>
              <tr>
                {data.columns.map(col => (
                  <th
                    key={col}
                    style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #3a3a3a", color: "#facc15", whiteSpace: "nowrap" }}
                  >
                    {col}
                    <span style={{ color: "#444", fontWeight: 400, marginLeft: 4, fontSize: 10 }}>
                      ({data.columnTypes[col]})
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#1a1a1a" : "#222" }}>
                  {data.columns.map(col => (
                    <td
                      key={col}
                      style={{ padding: "4px 8px", borderBottom: "1px solid #2a2a2a", color: "#d0d0d0", whiteSpace: "nowrap" }}
                    >
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: "0.75rem", alignItems: "center", justifyContent: "center" }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              style={{ padding: "0.3rem 0.75rem", borderRadius: 5, border: "1px solid #3a3a3a", background: "transparent", color: data.page <= 1 ? "#444" : "#aaa", cursor: data.page <= 1 ? "default" : "pointer", fontSize: 12 }}
            >
              ← Anterior
            </button>
            <span style={{ color: "#666", fontSize: 12 }}>{data.page} / {data.totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
              style={{ padding: "0.3rem 0.75rem", borderRadius: 5, border: "1px solid #3a3a3a", background: "transparent", color: data.page >= data.totalPages ? "#444" : "#aaa", cursor: data.page >= data.totalPages ? "default" : "pointer", fontSize: 12 }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, color = "#facc15" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "0.4rem 0.75rem", fontSize: 12 }}>
      <span style={{ color: "#666" }}>{label}: </span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}>
      <p style={{ color: "#aaa", fontSize: 12, margin: "0 0 0.5rem", fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  return String(value);
}
