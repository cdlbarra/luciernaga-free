"use client";
import type { ValidationReport, ValidationIssue } from "@/lib/dataValidator";

type Props = {
  report: ValidationReport;
  compact?: boolean;
};

const SEVERITY = {
  error:      { color: "#f87171", bg: "rgba(239,68,68,0.07)",     icon: "✗", label: "Error"       },
  warning:    { color: "#facc15", bg: "rgba(250,204,21,0.07)",    icon: "⚠", label: "Advertencia" },
  suggestion: { color: "#4ade80", bg: "rgba(74,222,128,0.07)",    icon: "ℹ", label: "Sugerencia"  },
} as const;

type SeverityKey = keyof typeof SEVERITY;

function issueRows(report: ValidationReport): { issue: ValidationIssue; sev: SeverityKey }[] {
  return [
    ...report.errores.map(i => ({ issue: i, sev: "error" as SeverityKey })),
    ...report.advertencias.map(i => ({ issue: i, sev: "warning" as SeverityKey })),
    ...report.sugerencias.map(i => ({ issue: i, sev: "suggestion" as SeverityKey })),
  ];
}

export function ValidationTable({ report, compact = false }: Props) {
  const rows = issueRows(report);

  const campos = Object.keys(report.tipos_detectados).filter(c => c !== "(fila completa)");
  const camposConProblema = new Set([
    ...report.errores.map(e => e.campo),
    ...report.advertencias.map(w => w.campo),
    ...report.sugerencias.map(s => s.campo),
  ]);
  const camposOK = campos.filter(c => !camposConProblema.has(c)).length;

  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>

      {/* Header */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #2a2a2a", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#aaa", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Validación de Datos
        </span>
        <span style={{ color: "#555", fontSize: 11 }}>
          {report.total_filas} filas · {report.resumen.porcentaje_completitud}% completitud
        </span>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              <th style={{ padding: "5px 12px", textAlign: "left", color: "#555", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tipo de error
              </th>
              <th style={{ padding: "5px 12px", textAlign: "left", color: "#555", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", width: compact ? 80 : 120 }}>
                Filas
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ issue, sev }, i) => {
              const s = SEVERITY[sev];
              return (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? s.bg : "transparent", borderBottom: "1px solid #1a1a1a" }}
                >
                  <td style={{ padding: "6px 12px" }}>
                    <span style={{ color: s.color, fontWeight: 600, marginRight: 6 }}>{s.icon} {s.label}</span>
                    <span style={{ color: "#777", fontFamily: "monospace", marginRight: 4 }}>[{issue.campo}]</span>
                    <span style={{ color: "#c0c0c0" }}>{issue.mensaje}</span>
                  </td>
                  <td style={{ padding: "6px 12px", color: "#555", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                    {issue.filas?.length
                      ? `${issue.filas.slice(0, compact ? 3 : 5).join(", ")}${(issue.filas.length > (compact ? 3 : 5)) ? "…" : ""}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: "10px 12px" }}>
          <span style={{ color: "#4ade80" }}>✓ Sin problemas detectados</span>
        </div>
      )}

      {/* Footer summary */}
      <div style={{ background: "#0d0d0d", borderTop: "1px solid #2a2a2a", padding: "5px 12px", display: "flex", gap: 20, fontSize: 12 }}>
        <span style={{ color: report.errores.length ? "#f87171" : "#3a3a3a" }}>
          ✗ {report.errores.length} error{report.errores.length !== 1 ? "es" : ""}
        </span>
        <span style={{ color: report.advertencias.length ? "#facc15" : "#3a3a3a" }}>
          ⚠ {report.advertencias.length} advertencia{report.advertencias.length !== 1 ? "s" : ""}
        </span>
        <span style={{ color: camposOK > 0 ? "#4ade80" : "#3a3a3a" }}>
          ✓ {camposOK} campo{camposOK !== 1 ? "s" : ""} OK
        </span>
      </div>
    </div>
  );
}
