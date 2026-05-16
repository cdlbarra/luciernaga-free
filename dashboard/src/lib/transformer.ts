const BOOL_TRUE = new Set(["true", "si", "sí", "yes", "1", "verdadero"]);
const BOOL_FALSE = new Set(["false", "no", "0", "falso"]);

function tryParseDate(value: string): string | null {
  const stripped = value.trim();
  if (!/\d{4}/.test(stripped)) return null;
  const d = new Date(stripped);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function detectAndClean(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value.normalize("NFC").trim();
    const lower = cleaned.toLowerCase();

    if (BOOL_TRUE.has(lower)) return true;
    if (BOOL_FALSE.has(lower)) return false;

    const isoDate = tryParseDate(cleaned);
    if (isoDate) return isoDate;

    const num = Number(cleaned.replace(",", "."));
    if (cleaned !== "" && !isNaN(num)) return num;

    return cleaned;
  }

  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;

  return String(value);
}

export function transformRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([field, value]) => [field, detectAndClean(value)])
  );
}

export function extractRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["rows", "records", "data", "items"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (r): r is Record<string, unknown> => typeof r === "object" && r !== null
        );
      }
    }
    // Formato columnar: { col1: [...], col2: [...] }
    const vals = Object.values(obj);
    if (vals.length > 0 && Array.isArray(vals[0])) {
      const keys = Object.keys(obj);
      const length = (vals[0] as unknown[]).length;
      return Array.from({ length }, (_, i) =>
        Object.fromEntries(keys.map((k, j) => [k, (vals[j] as unknown[])[i]]))
      );
    }
    return [obj];
  }
  return [];
}
