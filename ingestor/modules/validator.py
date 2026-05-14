# módulo: validator — Luciérnaga MVP
# Sistema de validación en 3 capas: rechazar / cuarentena / advertencia

from typing import Dict, List, Tuple, Any
from datetime import datetime
import json


class ValidationRules:
    """Define las reglas de validación por tipo de dato."""
    
    @staticmethod
    def validate_string(value: Any, min_len: int = 0, max_len: int = 10000, pattern: str = None) -> Tuple[bool, str]:
        """Valida strings."""
        if value is None:
            return False, "missing_value"
        if not isinstance(value, str):
            return False, "type_mismatch"
        if len(value) < min_len or len(value) > max_len:
            return False, "range_violation"
        return True, "valid"
    
    @staticmethod
    def validate_number(value: Any, min_val: float = None, max_val: float = None) -> Tuple[bool, str]:
        """Valida números."""
        if value is None:
            return False, "missing_value"
        if not isinstance(value, (int, float)):
            return False, "type_mismatch"
        if min_val is not None and value < min_val:
            return False, "range_violation"
        if max_val is not None and value > max_val:
            return False, "range_violation"
        return True, "valid"
    
    @staticmethod
    def validate_email(value: Any) -> Tuple[bool, str]:
        """Valida emails."""
        if value is None:
            return False, "missing_value"
        if not isinstance(value, str):
            return False, "type_mismatch"
        if "@" not in value or "." not in value.split("@")[1] if "@" in value else False:
            return False, "format_invalid"
        return True, "valid"
    
    @staticmethod
    def validate_date(value: Any, format_str: str = "%Y-%m-%d") -> Tuple[bool, str]:
        """Valida fechas."""
        if value is None:
            return False, "missing_value"
        if not isinstance(value, str):
            return False, "type_mismatch"
        try:
            datetime.strptime(value, format_str)
            return True, "valid"
        except ValueError:
            return False, "format_invalid"


class ValidationError:
    """Representa un error de validación."""
    
    def __init__(self, error_type: str, severity: str, field_name: str, 
                 field_value: Any, message: str, expected_type: str = None):
        self.error_type = error_type
        self.severity = severity
        self.field_name = field_name
        self.field_value = str(field_value) if field_value is not None else None
        self.message = message
        self.expected_type = expected_type
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict:
        return {
            "error_type": self.error_type,
            "severity": self.severity,
            "field_name": self.field_name,
            "field_value": self.field_value,
            "message": self.message,
            "expected_type": self.expected_type,
            "timestamp": self.timestamp
        }


class Validator:
    """Validador con 3 capas de decisión."""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._default_config()
        self.errors = []
        self.warnings = []
        self.critical_errors = []
    
    def _default_config(self) -> Dict:
        """Configuración por defecto."""
        return {
            "strict_mode": False,  # Si True, rechaza en warning; si False, acepta con warning
            "max_errors_before_reject": 3,  # Rechaza si hay 3+ errores críticos
            "quarantine_on_critical": True,  # Pone en cuarentena si hay errores críticos
            "auto_trim_strings": True,  # Auto-limpia espacios en strings
            "auto_lowercase_email": True,  # Auto-normaliza emails
        }
    
    def validate_record(self, record: Dict, schema: Dict = None) -> Tuple[str, Dict]:
        """
        Valida un registro completo.
        Retorna: (action, result_dict)
        action: 'accept', 'reject', 'quarantine'
        result_dict: {status, errors, warnings, quality_score, ...}
        """
        self.errors = []
        self.warnings = []
        self.critical_errors = []
        
        if not isinstance(record, dict):
            return "reject", {
                "status": "error",
                "reason": "Record is not a dictionary",
                "quality_score": 0
            }
        
        # Validar contra schema si se proporciona
        if schema:
            self._validate_against_schema(record, schema)
        
        # Decidir acción
        action = self._decide_action()
        
        result = {
            "status": action,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "critical_error_count": len(self.critical_errors),
            "quality_score": self._calculate_quality_score(),
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
        }
        
        return action, result
    
    def _validate_against_schema(self, record: Dict, schema: Dict):
        """Valida un registro contra su schema."""
        for field, rules in schema.items():
            if field not in record:
                error = ValidationError(
                    error_type="missing_value",
                    severity="error" if rules.get("required") else "warning",
                    field_name=field,
                    field_value=None,
                    message=f"Required field '{field}' is missing",
                    expected_type=rules.get("type")
                )
                if error.severity == "critical":
                    self.critical_errors.append(error)
                elif error.severity == "error":
                    self.errors.append(error)
                else:
                    self.warnings.append(error)
                continue
            
            value = record[field]
            field_type = rules.get("type")
            
            # Validar tipo
            if field_type == "string":
                is_valid, error_code = ValidationRules.validate_string(
                    value, 
                    min_len=rules.get("min_length", 0),
                    max_len=rules.get("max_length", 10000)
                )
            elif field_type == "number":
                is_valid, error_code = ValidationRules.validate_number(
                    value,
                    min_val=rules.get("min"),
                    max_val=rules.get("max")
                )
            elif field_type == "email":
                is_valid, error_code = ValidationRules.validate_email(value)
            elif field_type == "date":
                is_valid, error_code = ValidationRules.validate_date(value)
            else:
                is_valid = True
                error_code = "valid"
            
            if not is_valid:
                severity = rules.get("severity", "error")
                error = ValidationError(
                    error_type=error_code,
                    severity=severity,
                    field_name=field,
                    field_value=value,
                    message=f"Field '{field}' validation failed: {error_code}",
                    expected_type=field_type
                )
                
                if severity == "critical":
                    self.critical_errors.append(error)
                elif severity == "error":
                    self.errors.append(error)
                else:
                    self.warnings.append(error)
    
    def _decide_action(self) -> str:
        """Decide si aceptar, rechazar o enviar a cuarentena."""
        # Decisión 1: Si hay errores críticos, rechazar o enviar a cuarentena
        if self.critical_errors:
            if self.config.get("quarantine_on_critical"):
                return "quarantine"
            else:
                return "reject"
        
        # Decisión 2: Si hay demasiados errores, rechazar
        if len(self.errors) >= self.config.get("max_errors_before_reject", 3):
            return "reject"
        
        # Decisión 3: Si hay errores pero no muchos, enviar a cuarentena
        if self.errors:
            return "quarantine"
        
        # Decisión 4: Si solo hay warnings y no está en strict mode, aceptar
        if self.warnings and not self.config.get("strict_mode"):
            return "accept"
        
        # Aceptar
        return "accept"
    
    def _calculate_quality_score(self) -> int:
        """Calcula un score de 0-100 basado en errores y warnings."""
        base_score = 100
        base_score -= len(self.critical_errors) * 30
        base_score -= len(self.errors) * 10
        base_score -= len(self.warnings) * 2
        return max(0, min(100, base_score))


def run(context: dict) -> dict:
    """
    Módulo validator — ejecuta validación en 3 capas.
    
    Input context debe contener:
    - raw_data: Dict con los datos a validar
    - schema: Dict con reglas de validación (opcional)
    - config: Dict con configuración del validador (opcional)
    
    Output context añade:
    - validation_result: {action, status, errors, warnings, quality_score}
    - validation_action: 'accept', 'reject', 'quarantine'
    """
    
    raw_data = context.get("raw_data", {})
    schema = context.get("schema")
    config = context.get("validation_config")
    
    validator = Validator(config=config)
    action, result = validator.validate_record(raw_data, schema)
    
    context["validation_result"] = result
    context["validation_action"] = action
    
    return context
