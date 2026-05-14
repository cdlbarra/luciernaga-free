# Sistema de Validación en 3 Capas — Luciérnaga MVP

## 🎯 Resumen Ejecutivo

Implementamos un **sistema de validación con 3 capas de decisión** que automáticamente:

1. **Acepta** ✅ datos válidos
2. **Rechaza** ❌ datos con errores críticos
3. **Pone en cuarentena** 🔒 datos sospechosos para revisión manual

---

## 📊 Arquitectura

### Flujo de Datos

```
Raw Data
   ↓
[Validator Module] — Evalúa contra schema
   ↓
   ├─→ ACCEPT ✅ → Procesar normalmente
   ├─→ REJECT ❌ → Registrar en validation_errors
   └─→ QUARANTINE 🔒 → Guardar en tabla quarantine para revisión
```

### Nuevas Tablas Supabase

#### `validation_errors`
Registro de TODOS los errores detectados.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `ingestor_id` | UUID | FK a ingestors |
| `raw_data_id` | UUID | FK a raw_data |
| `error_type` | TEXT | missing_value, type_mismatch, format_invalid, range_violation, duplicate, inconsistency, critical |
| `severity` | TEXT | warning, error, critical |
| `field_name` | TEXT | Campo donde ocurrió el error |
| `field_value` | TEXT | Valor que causó el error |
| `error_message` | TEXT | Descripción del error |
| `action_taken` | TEXT | accepted, rejected, quarantined |
| `created_at` | TIMESTAMPTZ | |

#### `quarantine`
Registros rechazados pero guardados para revisión manual.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `ingestor_id` | UUID | FK |
| `raw_data_id` | UUID | FK |
| `original_data` | JSONB | Datos completos originales |
| `quarantine_reason` | TEXT | "missing_value on email; type_mismatch on age" |
| `error_details` | JSONB | {errors: [...], warnings: [...], quality_score: 0-100} |
| `status` | TEXT | pending, reviewed, approved, rejected |
| `reviewed_by` | TEXT | Usuario que revisó |
| `reviewed_at` | TIMESTAMPTZ | |
| `action` | TEXT | accept, reject, discard |
| `notes` | TEXT | Notas del revisor |

#### `validation_summary`
Estadísticas diarias por ingestor.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `ingestor_id` | UUID | FK |
| `date` | DATE | Fecha |
| `total_records` | INT | Total procesados |
| `valid_records` | INT | Pasaron validación |
| `records_with_warnings` | INT | Con warnings (aceptados) |
| `records_with_errors` | INT | Con errores (cuarentena) |
| `critical_errors` | INT | Errores críticos |
| `quarantined_records` | INT | En cuarentena |
| `acceptance_rate` | FLOAT | % válidos |

---

## 🔧 Uso en el Código

### Paso 1: Definir un Schema

```python
from utilidades import SCHEMA_USER, get_config_for_mode

# Usar schema predefinido
schema = SCHEMA_USER

# O definir uno personalizado
schema = {
    "id": {"type": "string", "required": True},
    "email": {"type": "email", "required": True},
    "name": {"type": "string", "required": True, "min_length": 2},
    "age": {"type": "number", "required": False, "min": 0, "max": 150, "severity": "warning"},
}
```

### Paso 2: Configurar el Validador

```python
from utilidades import get_config_for_mode

# 3 modos predefinidos
config = get_config_for_mode("strict")    # Rechaza en warnings
config = get_config_for_mode("lenient")   # Acepta con warnings
config = get_config_for_mode("learning")  # Muy permisivo

# O configuración personalizada
config = {
    "strict_mode": False,
    "max_errors_before_reject": 3,
    "quarantine_on_critical": True,
    "auto_trim_strings": True,
    "auto_lowercase_email": True,
}
```

### Paso 3: Llamar al Validador

```python
from modules.validator import run

context = {
    "raw_data": {
        "id": "123",
        "email": "user@example.com",
        "name": "John Doe",
        "age": 30
    },
    "schema": schema,
    "validation_config": config
}

context = run(context)

print(context["validation_action"])  # "accept", "reject", "quarantine"
print(context["validation_result"])  # {status, errors, warnings, quality_score}
```

---

## 🌐 Endpoints de la API

### Validar Datos

```bash
POST /validate
Content-Type: application/json

{
  "ingestor_id": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "id": "456",
    "email": "test@test.com",
    "name": "Test User"
  },
  "schema": {...}
}

# Response
{
  "action": "accept",
  "result": {
    "status": "accept",
    "error_count": 0,
    "warning_count": 0,
    "quality_score": 100,
    "errors": [],
    "warnings": []
  },
  "timestamp": "2025-05-14T19:30:00Z"
}
```

### Ver Errores de Validación

```bash
GET /validation-errors?ingestor_id=123&severity=critical&limit=100

# Response
[
  {
    "id": "...",
    "ingestor_id": "...",
    "error_type": "missing_value",
    "severity": "critical",
    "field_name": "email",
    "error_message": "Required field 'email' is missing",
    "action_taken": null,
    "created_at": "2025-05-14T19:00:00Z"
  },
  ...
]
```

### Ver Cuarentena

```bash
GET /quarantine?ingestor_id=123&status=pending&limit=50

# Response
[
  {
    "id": "...",
    "ingestor_id": "...",
    "original_data": {...},
    "quarantine_reason": "missing_value on email; type_mismatch on age",
    "error_details": {
      "errors": [...],
      "warnings": [...],
      "quality_score": 35
    },
    "status": "pending",
    "reviewed_by": null,
    "created_at": "2025-05-14T19:00:00Z"
  },
  ...
]
```

### Revisar Un Registro en Cuarentena

```bash
POST /quarantine/{quarantine_id}/review
Content-Type: application/json

{
  "action": "accept",  # o "reject", "discard"
  "reviewed_by": "cesar@example.com",
  "notes": "Datos correctos, solo faltaba formato de email"
}

# Response
[
  {
    "id": "...",
    "status": "reviewed",
    "action": "accept",
    "reviewed_by": "cesar@example.com",
    "reviewed_at": "2025-05-14T19:30:00Z",
    "notes": "Datos correctos..."
  }
]
```

### Ver Estadísticas de Validación

```bash
GET /validation-stats/{ingestor_id}?days=7

# Response
{
  "ingestor_id": "...",
  "period_days": 7,
  "summary": {
    "total_records": 1000,
    "valid_records": 920,
    "quarantined_records": 60,
    "critical_errors": 20,
    "acceptance_rate": 92.0
  },
  "daily_breakdown": [
    {
      "date": "2025-05-14",
      "total_records": 150,
      "valid_records": 138,
      "records_with_warnings": 8,
      "critical_errors": 4,
      "acceptance_rate": 92.0
    },
    ...
  ]
}
```

---

## 📋 Tipos de Errores

### Por Tipo

| Código | Descripción | Ejemplo |
|--------|-------------|---------|
| `missing_value` | Campo requerido ausente | Email vacío |
| `type_mismatch` | Tipo de dato incorrecto | "abc" en número |
| `format_invalid` | Formato no válido | "not-an-email" en email |
| `range_violation` | Valor fuera de rango | -5 en edad |
| `duplicate` | Valor duplicado | ID duplicado |
| `inconsistency` | Datos inconsistentes | Monto vs. balance |
| `critical` | Error que detiene procesamiento | Corrupción de datos |

### Por Severidad

| Nivel | Acción | Ejemplo |
|-------|--------|---------|
| `warning` | Aceptar pero registrar | Edad sospechosa pero válida |
| `error` | Enviar a cuarentena | Email faltante |
| `critical` | Rechazar o cuarentena | Tipo de dato completamente inválido |

---

## 📈 Dashboard Data (Next.js)

```typescript
// Fetch estadísticas
const stats = await fetch(
  `http://localhost:8080/validation-stats/${ingestorId}?days=7`
).then(r => r.json());

// Mostrar en gráfico
<ValidationChart
  data={stats.daily_breakdown}
  acceptanceRate={stats.summary.acceptance_rate}
/>

// Botón para revisar cuarentena
<QuarantinePanel
  records={quarantineList}
  onReview={(id, action) => 
    fetch(`/quarantine/${id}/review`, {
      method: "POST",
      body: JSON.stringify({action, reviewed_by: user.email})
    })
  }
/>
```

---

## ⚙️ Configuración por Caso de Uso

### Caso 1: Datos Críticos (Banking, Healthcare)

```python
config = get_config_for_mode("strict")
# → Rechaza al primer error
# → Cuarentena si hay warnings
# → Quality score muy alto requerido
```

### Caso 2: Datos Normales (E-commerce, CRM)

```python
config = get_config_for_mode("lenient")
# → Acepta con warnings
# → Cuarentena si hay 5+ errores
# → Quality score 70+
```

### Caso 3: Ingesta Nueva (Learning Phase)

```python
config = get_config_for_mode("learning")
# → Acepta la mayoría
# → Registra todo para análisis
# → No rechaza críticos, solo cuarentena
```

---

## 🚀 Próximos Pasos

### Antes de Producción

1. **Ejecutar migración 004** en Supabase:
   ```bash
   # Dashboard > SQL Editor > Copiar y ejecutar supabase/migrations/004_validation_system.sql
   ```

2. **Configurar Railway** con variables de entorno:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

3. **Desplegar** ingestor actualizado:
   ```bash
   git push origin main
   # Railway redeploy automático
   ```

4. **Conectar Dashboard** a los nuevos endpoints:
   - Agregar panel de validación
   - Agregar panel de cuarentena
   - Agregar gráficos de estadísticas

### Mejoras Futuras

- [ ] Auto-corrección inteligente (trim, lowercase, parse dates)
- [ ] Machine learning para detectar anomalías
- [ ] Validación temporal (valores deben estar dentro de ventana de tiempo)
- [ ] Reglas condicionales (si A = X, entonces B debe ser Y)
- [ ] Batch approval de cuarentena
- [ ] Webhooks para notificaciones

---

## 📞 Soporte

Error común: `validation_errors table not found`
→ Ejecuta la migración 004 en Supabase antes de usar los endpoints

Error común: `TypeError: cannot read property 'get' of undefined`
→ Verifica que `context` contenga `raw_data` y `schema`

---

## 📚 Referencias

- Módulo: `ingestor/modules/validator.py`
- Utilidades: `ingestor/utilidades.py`
- Endpoints: `ingestor/main.py` (líneas 102+)
- Migración: `supabase/migrations/004_validation_system.sql`
