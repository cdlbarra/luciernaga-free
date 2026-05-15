# módulo: transformer — Luciérnaga MVP
# Curación de datos: detección de tipos, normalización y generación de metadata

from typing import Any, Tuple, Dict, List
from datetime import datetime
import unicodedata

DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%Y%m%d",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y %H:%M:%S",
]

_BOOL_TRUE = {"true", "si", "sí", "yes", "1", "verdadero"}
_BOOL_FALSE = {"false", "no", "0", "falso"}


def _try_parse_date(value: str) -> Tuple[bool, str | None]:
    stripped = value.strip()
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(stripped, fmt)
            return True, dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return False, None


def _detect_and_clean(value: Any) -> Tuple[str, Any]:
    if value is None or value == "":
        return "null", None

    if isinstance(value, bool):
        return "boolean", value

    if isinstance(value, (int, float)):
        return "number", value

    if isinstance(value, str):
        cleaned = unicodedata.normalize("NFC", value.strip())

        lower = cleaned.lower()
        if lower in _BOOL_TRUE:
            return "boolean", True
        if lower in _BOOL_FALSE:
            return "boolean", False

        is_date, iso_date = _try_parse_date(cleaned)
        if is_date:
            return "date", iso_date

        try:
            if "." in cleaned or "," in cleaned:
                return "number", float(cleaned.replace(",", "."))
            return "number", int(cleaned)
        except ValueError:
            pass

        return "string", cleaned

    if isinstance(value, list):
        return "array", value

    if isinstance(value, dict):
        return "object", value

    return "unknown", str(value)


def _field_metadata(original: Any, cleaned: Any, detected_type: str) -> Dict:
    is_null = original is None or original == ""
    meta: Dict[str, Any] = {
        "type": detected_type,
        "count": 0 if is_null else 1,
        "null_count": 1 if is_null else 0,
    }

    if detected_type == "number" and cleaned is not None:
        meta["min"] = cleaned
        meta["max"] = cleaned

    if detected_type == "string" and cleaned is not None:
        length = len(cleaned)
        meta["length_min"] = length
        meta["length_max"] = length
        meta["unique_count"] = 1
        meta["categories"] = [cleaned]

    if detected_type == "date" and cleaned is not None:
        meta["date_range"] = {"start": cleaned, "end": cleaned}

    if detected_type == "boolean" and cleaned is not None:
        meta["unique_count"] = 1
        meta["categories"] = [cleaned]

    return meta


def transform_data(raw_json: dict) -> tuple[dict, dict]:
    """
    Detecta tipos, limpia y normaliza cada campo de raw_json.
    Retorna: (datos_transformados, metadata_por_campo)
    """
    if not isinstance(raw_json, dict):
        return {}, {"_error": "El input no es un diccionario"}

    transformed: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

    for field, value in raw_json.items():
        detected_type, cleaned = _detect_and_clean(value)
        transformed[field] = cleaned
        metadata[field] = _field_metadata(value, cleaned, detected_type)

    return transformed, metadata


def aggregate_metadata(metadata_list: List[Dict]) -> Dict:
    """
    Combina metadata de múltiples transformaciones en estadísticas globales.
    """
    aggregated: Dict[str, Dict] = {}

    for meta in metadata_list:
        if not isinstance(meta, dict):
            continue
        for field, field_meta in meta.items():
            if field.startswith("_"):
                continue
            if field not in aggregated:
                aggregated[field] = {
                    "type": field_meta.get("type"),
                    "count": 0,
                    "null_count": 0,
                    "_unique_values": set(),
                }
            agg = aggregated[field]
            agg["count"] += field_meta.get("count", 0)
            agg["null_count"] += field_meta.get("null_count", 0)

            ftype = field_meta.get("type")

            if ftype == "number":
                for key, cmp in (("min", min), ("max", max)):
                    if key in field_meta:
                        sentinel = float("inf") if key == "min" else float("-inf")
                        agg[key] = cmp(agg.get(key, sentinel), field_meta[key])

            if ftype == "string":
                if "length_min" in field_meta:
                    agg["length_min"] = min(agg.get("length_min", float("inf")), field_meta["length_min"])
                    agg["length_max"] = max(agg.get("length_max", 0), field_meta["length_max"])

            if ftype == "date" and "date_range" in field_meta:
                dr = field_meta["date_range"]
                if "date_range" not in agg:
                    agg["date_range"] = dict(dr)
                else:
                    if dr["start"] < agg["date_range"]["start"]:
                        agg["date_range"]["start"] = dr["start"]
                    if dr["end"] > agg["date_range"]["end"]:
                        agg["date_range"]["end"] = dr["end"]

            for val in field_meta.get("categories", []):
                agg["_unique_values"].add(str(val))

    result: Dict[str, Any] = {}
    for field, agg in aggregated.items():
        unique_vals = list(agg.pop("_unique_values"))
        entry = {**agg, "unique_count": len(unique_vals)}
        if len(unique_vals) <= 20:
            entry["categories"] = unique_vals
        result[field] = entry

    return result


def run(context: dict) -> dict:
    """
    Módulo transformer — integración con el pipeline.
    Espera context["raw_data"]; añade context["transformed_data"] y context["transform_metadata"].
    """
    raw_data = context.get("raw_data", {})
    transformed, metadata = transform_data(raw_data)
    context["transformed_data"] = transformed
    context["transform_metadata"] = metadata
    return context
