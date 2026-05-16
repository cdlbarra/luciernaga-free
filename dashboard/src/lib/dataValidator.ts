export type DataType = "string" | "number" | "date" | "email" | "boolean" | "empty";
export type FieldTypes = Record<string, DataType>;

export interface ValidationIssue {
  type: "error" | "warning" | "suggestion";
  campo: string;
  mensaje: string;
  filas?: number[];
}

export interface ValidationReport {
  total_filas: number;
  tipos_detectados: FieldTypes;
  errores: ValidationIssue[];
  advertencias: ValidationIssue[];
  sugerencias: ValidationIssue[];
  resumen: {
    tiene_errores: boolean;
    tiene_advertencias: boolean;
    porcentaje_completitud: number;
  };
}

function inferType(values: unknown[]): DataType {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== "");
  if (!nonEmpty.length) return "empty";
  const sample = nonEmpty.slice(0, 100).map(String);
  if (sample.every(v => v === "true" || v === "false")) return "boolean";
  if (sample.every(v => v.trim() !== "" && !isNaN(Number(v)))) return "number";
  if (sample.every(v => /^\S+@\S+\.\S+$/.test(v))) return "email";
  if (sample.every(v => /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(v) && !isNaN(Date.parse(v)))) return "date";
  return "string";
}

export function detectarTiposDatos(filas: Record<string, unknown>[]): FieldTypes {
  if (!filas.length) return {};
  const tipos: FieldTypes = {};
  for (const campo of Object.keys(filas[0])) {
    tipos[campo] = inferType(filas.map(f => f[campo]));
  }
  return tipos;
}

export function validarConsistencia(filas: Record<string, unknown>[], tipos: FieldTypes): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [campo, tipo] of Object.entries(tipos)) {
    if (tipo === "empty" || tipo === "string") continue;
    const invalidas: number[] = [];
    filas.forEach((fila, i) => {
      const val = fila[campo];
      if (val === null || val === undefined || val === "") return;
      const s = String(val);
      let invalido = false;
      if (tipo === "number") invalido = isNaN(Number(s));
      else if (tipo === "email") invalido = !/^\S+@\S+\.\S+$/.test(s);
      else if (tipo === "date") invalido = isNaN(Date.parse(s));
      else if (tipo === "boolean") invalido = s !== "true" && s !== "false";
      if (invalido) invalidas.push(i + 1);
    });
    if (invalidas.length) {
      issues.push({ type: "error", campo, mensaje: `${invalidas.length} valor(es) no coinciden con tipo detectado (${tipo})`, filas: invalidas.slice(0, 10) });
    }
  }
  return issues;
}

export function detectarValoresFaltantes(filas: Record<string, unknown>[]): ValidationIssue[] {
  if (!filas.length) return [];
  const issues: ValidationIssue[] = [];
  for (const campo of Object.keys(filas[0])) {
    const faltantes = filas.map((f, i) => ({ val: f[campo], idx: i + 1 })).filter(({ val }) => val === null || val === undefined || val === "");
    if (!faltantes.length) continue;
    const pct = (faltantes.length / filas.length) * 100;
    issues.push({
      type: pct > 20 ? "error" : pct > 5 ? "warning" : "suggestion",
      campo,
      mensaje: `${faltantes.length} valor(es) faltante(s) (${pct.toFixed(1)}%)`,
      filas: faltantes.map(f => f.idx).slice(0, 10),
    });
  }
  return issues;
}

export function detectarDuplicados(filas: Record<string, unknown>[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  const duplicados: number[] = [];
  filas.forEach((fila, i) => {
    const key = JSON.stringify(fila);
    if (seen.has(key)) duplicados.push(i + 1);
    else seen.set(key, i + 1);
  });
  if (!duplicados.length) return [];
  return [{ type: "warning", campo: "(fila completa)", mensaje: `${duplicados.length} fila(s) duplicada(s) detectada(s)`, filas: duplicados.slice(0, 10) }];
}

export function detectarOutliers(filas: Record<string, unknown>[], tipos: FieldTypes): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [campo, tipo] of Object.entries(tipos)) {
    if (tipo !== "number") continue;
    const vals = filas.map((f, i) => ({ val: Number(f[campo]), idx: i + 1 })).filter(({ val }) => !isNaN(val));
    if (vals.length < 4) continue;
    const sorted = [...vals].sort((a, b) => a.val - b.val);
    const q1 = sorted[Math.floor(sorted.length * 0.25)].val;
    const q3 = sorted[Math.floor(sorted.length * 0.75)].val;
    const iqr = q3 - q1;
    if (iqr === 0) continue;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const outliers = vals.filter(({ val }) => val < lower || val > upper);
    if (outliers.length) {
      issues.push({
        type: "suggestion",
        campo,
        mensaje: `${outliers.length} valor(es) fuera del rango esperado [${lower.toFixed(1)}, ${upper.toFixed(1)}]`,
        filas: outliers.map(o => o.idx).slice(0, 10),
      });
    }
  }
  return issues;
}

// Excel serial dates: day count since 1900-01-01. Range 30000–60000 ≈ 1982–2064.
const EXCEL_DATE_MIN = 30000;
const EXCEL_DATE_MAX = 60000;

export function detectarFechasSeriales(filas: Record<string, unknown>[], tipos: FieldTypes): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [campo, tipo] of Object.entries(tipos)) {
    if (tipo !== "number") continue;
    const nums = filas
      .map(f => Number(f[campo]))
      .filter(v => !isNaN(v) && Number.isInteger(v));
    if (nums.length < Math.ceil(filas.length * 0.8)) continue;
    const enRango = nums.filter(v => v >= EXCEL_DATE_MIN && v <= EXCEL_DATE_MAX);
    if (enRango.length >= Math.ceil(nums.length * 0.9)) {
      issues.push({
        type: "warning",
        campo,
        mensaje: `Los valores parecen fechas seriales de Excel (ej. ${nums[0]}). Convertir a formato fecha legible.`,
      });
    }
  }
  return issues;
}

export function generarReportValidacion(filas: Record<string, unknown>[]): ValidationReport {
  if (!filas.length) {
    return { total_filas: 0, tipos_detectados: {}, errores: [], advertencias: [], sugerencias: [], resumen: { tiene_errores: false, tiene_advertencias: false, porcentaje_completitud: 100 } };
  }
  const tipos = detectarTiposDatos(filas);
  const todos = [
    ...validarConsistencia(filas, tipos),
    ...detectarValoresFaltantes(filas),
    ...detectarDuplicados(filas),
    ...detectarOutliers(filas, tipos),
    ...detectarFechasSeriales(filas, tipos),
  ];
  const errores = todos.filter(i => i.type === "error");
  const advertencias = todos.filter(i => i.type === "warning");
  const sugerencias = todos.filter(i => i.type === "suggestion");

  const campos = Object.keys(filas[0]);
  const totalCeldas = filas.length * campos.length;
  const vacias = campos.reduce((acc, c) => acc + filas.filter(f => f[c] === null || f[c] === undefined || f[c] === "").length, 0);

  return {
    total_filas: filas.length,
    tipos_detectados: tipos,
    errores,
    advertencias,
    sugerencias,
    resumen: {
      tiene_errores: errores.length > 0,
      tiene_advertencias: advertencias.length > 0,
      porcentaje_completitud: Math.round(((totalCeldas - vacias) / totalCeldas) * 1000) / 10,
    },
  };
}
