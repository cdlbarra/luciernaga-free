# utilidades.py — Luciérnaga MVP
# Esquemas, configuraciones y helpers comunes

from typing import Dict, List
from datetime import datetime

# ============ ESQUEMAS DE VALIDACIÓN PREDEFINIDOS ============

SCHEMA_USER = {
    "id": {"type": "string", "required": True, "min_length": 1},
    "email": {"type": "email", "required": True},
    "name": {"type": "string", "required": True, "min_length": 2, "max_length": 255},
    "age": {"type": "number", "required": False, "min": 0, "max": 150, "severity": "warning"},
    "created_at": {"type": "date", "required": True},
}

SCHEMA_TRANSACTION = {
    "id": {"type": "string", "required": True},
    "amount": {"type": "number", "required": True, "min": 0},
    "currency": {"type": "string", "required": True},
    "from_account": {"type": "string", "required": True},
    "to_account": {"type": "string", "required": True},
    "timestamp": {"type": "date", "required": True},
    "status": {"type": "string", "required": True},
}

SCHEMA_PRODUCT = {
    "sku": {"type": "string", "required": True},
    "name": {"type": "string", "required": True, "min_length": 3},
    "price": {"type": "number", "required": True, "min": 0},
    "stock": {"type": "number", "required": True, "min": 0},
    "category": {"type": "string", "required": False},
}

# ============ CONFIGURACIONES DE VALIDACIÓN ============

CONFIG_STRICT = {
    "strict_mode": True,
    "max_errors_before_reject": 1,
    "quarantine_on_critical": True,
    "auto_trim_strings": True,
    "auto_lowercase_email": True,
}

CONFIG_LENIENT = {
    "strict_mode": False,
    "max_errors_before_reject": 5,
    "quarantine_on_critical": True,
    "auto_trim_strings": True,
    "auto_lowercase_email": True,
}

CONFIG_LEARNING = {
    "strict_mode": False,
    "max_errors_before_reject": 10,
    "quarantine_on_critical": False,
    "auto_trim_strings": True,
    "auto_lowercase_email": True,
}

# ============ HELPERS ============

def get_schema_for_type(data_type: str) -> Dict:
    """Retorna el schema predefinido para un tipo de dato."""
    schemas = {
        "user": SCHEMA_USER,
        "transaction": SCHEMA_TRANSACTION,
        "product": SCHEMA_PRODUCT,
    }
    return schemas.get(data_type.lower(), {})

def get_config_for_mode(mode: str) -> Dict:
    """Retorna la configuración predefinida para un modo."""
    configs = {
        "strict": CONFIG_STRICT,
        "lenient": CONFIG_LENIENT,
        "learning": CONFIG_LEARNING,
    }
    return configs.get(mode.lower(), CONFIG_LENIENT)

def format_quarantine_reason(error_list: List[Dict]) -> str:
    """Formatea una lista de errores en un mensaje legible."""
    if not error_list:
        return "Unknown reason"
    
    reasons = []
    for error in error_list[:3]:  # Primeros 3 errores
        reason = f"{error.get('error_type', 'unknown')} on {error.get('field_name', 'unknown field')}"
        reasons.append(reason)
    
    if len(error_list) > 3:
        reasons.append(f"and {len(error_list) - 3} more errors")
    
    return "; ".join(reasons)

def calculate_data_quality_score(validation_result: Dict) -> float:
    """Calcula un score de calidad basado en el resultado de validación."""
    return validation_result.get("quality_score", 0)

def should_quarantine(validation_result: Dict) -> bool:
    """Determina si un registro debe ir a cuarentena."""
    action = validation_result.get("status")
    return action in ["quarantine", "error"]

def build_quarantine_entry(
    ingestor_id: str,
    raw_data_id: str,
    original_data: Dict,
    validation_result: Dict,
    reason: str = None
) -> Dict:
    """Construye una entrada para la tabla quarantine."""
    if reason is None:
        reason = format_quarantine_reason(validation_result.get("errors", []))
    
    return {
        "ingestor_id": ingestor_id,
        "raw_data_id": raw_data_id,
        "original_data": original_data,
        "quarantine_reason": reason,
        "error_details": {
            "errors": validation_result.get("errors", []),
            "warnings": validation_result.get("warnings", []),
            "quality_score": validation_result.get("quality_score", 0),
        },
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }

def build_validation_error_entry(
    ingestor_id: str,
    raw_data_id: str,
    error_dict: Dict
) -> Dict:
    """Construye una entrada para la tabla validation_errors."""
    return {
        "ingestor_id": ingestor_id,
        "raw_data_id": raw_data_id,
        "error_type": error_dict.get("error_type"),
        "severity": error_dict.get("severity"),
        "field_name": error_dict.get("field_name"),
        "field_value": error_dict.get("field_value"),
        "expected_type": error_dict.get("expected_type"),
        "error_message": error_dict.get("message"),
        "action_taken": None,
        "created_at": datetime.utcnow().isoformat(),
    }

# ============ DASHBOARD HELPERS ============

def build_validation_dashboard_data(stats: Dict) -> Dict:
    """Transforma datos de validación para mostrar en dashboard."""
    return {
        "overview": {
            "total_records": stats.get("total_records", 0),
            "acceptance_rate": stats.get("acceptance_rate", 0),
            "critical_errors": stats.get("critical_errors", 0),
            "quarantined": stats.get("quarantined_records", 0),
        },
        "breakdown": {
            "valid": stats.get("valid_records", 0),
            "warnings": stats.get("records_with_warnings", 0),
            "errors": stats.get("records_with_errors", 0),
            "critical": stats.get("critical_errors", 0),
        },
        "quality_trend": "improving" if stats.get("acceptance_rate", 0) > 85 else "needs_attention"
    }
