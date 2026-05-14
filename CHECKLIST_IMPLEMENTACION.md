# ✅ CHECKLIST — Sistema de Validación en 3 Capas

## 📋 Pasos a Seguir (Orden Importante)

### FASE 1: Database (Supabase) — 5 minutos

- [ ] **1.1** Abre [Supabase Dashboard](https://app.supabase.com)
- [ ] **1.2** Selecciona tu proyecto Luciérnaga
- [ ] **1.3** Ve a **SQL Editor**
- [ ] **1.4** Copia el contenido de `supabase/migrations/004_validation_system.sql`
- [ ] **1.5** Pega en el editor y ejecuta (Command + Enter)
- [ ] **1.6** Espera a que termine (debe decir "✓ Success")

**✓ Resultado:** 4 nuevas tablas + índices + columnas en raw_data

---

### FASE 2: Backend (Railway) — 10 minutos

#### Opción A: GitHub Auto-Deploy (Recomendado)

- [ ] **2.1** Ve a tu terminal local en `C:\Users\cdlbarra\luciernaga-free`
- [ ] **2.2** `git add -A` (staged los cambios que descargaste)
- [ ] **2.3** `git commit -m "feat: validation system 3 capas"`
- [ ] **2.4** `git push origin main`
- [ ] **2.5** Espera 2-3 min a que Railway redeploy automáticamente

**Verificar deployment:**
```bash
# En PowerShell, espera 2 min y ejecuta:
curl https://luciernaga-free.railway.app/health
# Debe retornar: {"status":"ok","service":"ingestor"}
```

#### Opción B: Redeploy Manual en Railway

- [ ] **2.1** Ve a [Railway Dashboard](https://railway.app/project)
- [ ] **2.2** Selecciona "luciernaga-free" > "Deployments"
- [ ] **2.3** Click en el deploy actual
- [ ] **2.4** Botón "Redeploy" (arriba a la derecha)
- [ ] **2.5** Espera a que termine (status: "Success")

---

### FASE 3: Verificar Endpoints — 5 minutos

Ejecuta estos comandos en PowerShell para verificar que todo está funcionando:

#### 3.1 Health Check
```bash
curl "https://luciernaga-free.railway.app/health"
# Esperado: {"status":"ok","service":"ingestor"}
```

#### 3.2 Get Validation Errors (vacío, es normal)
```bash
curl "https://luciernaga-free.railway.app/validation-errors"
# Esperado: []
```

#### 3.3 Get Quarantine (vacío, es normal)
```bash
curl "https://luciernaga-free.railway.app/quarantine"
# Esperado: []
```

- [ ] **3.1** Todos los endpoints responden sin error 500 ✓
- [ ] **3.2** Las tablas existen y están vacías ✓

---

### FASE 4: Test con Datos Reales — 10 minutos

#### 4.1 Ejecutar ejemplo local

```bash
# En tu terminal, en /ingestor
python EJEMPLO_VALIDACION.py

# Esperado: 
# - 5 usuarios procesados
# - 1 aceptado ✅
# - 2 en cuarentena 🔒
# - 2 rechazados ❌
```

- [ ] **4.1** Ejecuta sin errores ✓

#### 4.2 Verificar que datos se guardaron en Supabase

```bash
# Ve a Supabase Dashboard > Table Editor
# Verifica que exista data en:
```

- [ ] **4.2** raw_data tiene 5 registros ✓
- [ ] **4.3** validation_errors tiene 4+ registros ✓
- [ ] **4.4** quarantine tiene 2 registros ✓

---

### FASE 5: Integración Dashboard (Opcional, pero importante)

#### 5.1 Agregar componente ValidationStats

En tu archivo `dashboard/src/components/`:

```bash
# Crear archivo: ValidationStats.tsx
```

```typescript
import { useEffect, useState } from 'react';

export function ValidationStats({ ingestorId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_INGESTOR_URL}/validation-stats/${ingestorId}?days=7`)
      .then(r => r.json())
      .then(setStats);
  }, [ingestorId]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="card">
        <h3>Total records</h3>
        <p className="text-2xl">{stats.summary.total_records}</p>
      </div>
      <div className="card">
        <h3>Acceptance rate</h3>
        <p className="text-2xl">{stats.summary.acceptance_rate.toFixed(1)}%</p>
      </div>
      <div className="card">
        <h3>Quarantined</h3>
        <p className="text-2xl">{stats.summary.quarantined_records}</p>
      </div>
      <div className="card">
        <h3>Critical errors</h3>
        <p className="text-2xl text-red-600">{stats.summary.critical_errors}</p>
      </div>
    </div>
  );
}
```

- [ ] **5.1** Componente creado ✓
- [ ] **5.2** Importado en página principal ✓
- [ ] **5.3** Muestra estadísticas en tiempo real ✓

#### 5.2 Agregar panel de cuarentena

```typescript
export function QuarantinePanel({ ingestorId }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_INGESTOR_URL}/quarantine?status=pending`)
      .then(r => r.json())
      .then(setRecords);
  }, []);

  return (
    <div className="panel">
      <h2>Cuarentena ({records.length})</h2>
      {records.map(record => (
        <div key={record.id} className="card">
          <p>{record.quarantine_reason}</p>
          <button onClick={() => handleReview(record.id, 'accept')}>
            Aceptar
          </button>
          <button onClick={() => handleReview(record.id, 'reject')}>
            Rechazar
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **5.4** Panel de cuarentena integrado ✓

---

### FASE 6: Validación en Formularios (Próximo)

Cuando tengas formularios en el dashboard:

```typescript
const [validationResult, setValidationResult] = useState(null);

async function handleSubmit(formData) {
  const result = await fetch(
    `${process.env.NEXT_PUBLIC_INGESTOR_URL}/validate`,
    {
      method: 'POST',
      body: JSON.stringify({
        ingestor_id: currentIngestor.id,
        data: formData,
        schema: SCHEMA_USER // usa el schema apropiado
      })
    }
  ).then(r => r.json());

  setValidationResult(result);

  if (result.action === 'accept') {
    // Guardar dato
  } else if (result.action === 'quarantine') {
    // Mostrar warning
  } else {
    // Mostrar error
  }
}
```

---

## 🎯 Checkpoints de Validación

### Checkpoint 1: ¿Base de datos está lista?
```sql
-- En Supabase SQL Editor
SELECT COUNT(*) FROM validation_errors;
-- Debe retornar: count = 0 (tablas existen aunque vacías)
```

✓ Si retorna 0, la migración funcionó

### Checkpoint 2: ¿API está respondiendo?
```bash
curl "https://luciernaga-free.railway.app/validation-stats/test"
# Debe retornar error 500 o datos, no "connection refused"
```

✓ Si no es "connection refused", el API está activo

### Checkpoint 3: ¿Dashboard ve los datos?
Abre la consola (F12) en tu dashboard y ejecuta:
```javascript
fetch('https://luciernaga-free.railway.app/validation-stats/123')
  .then(r => r.json())
  .then(console.log)
```

✓ Si ves data, todo está conectado

---

## 🚨 Troubleshooting Rápido

| Problema | Causa | Solución |
|----------|-------|----------|
| `relation "validation_errors" does not exist` | Migración no ejecutada | Ejecuta migración 004 en Supabase |
| `TypeError: Cannot read property 'get'` | Variables de entorno faltantes | Agrega SUPABASE_URL y SUPABASE_KEY en Railway |
| `curl: Could not resolve host` | Railway no ha desplegado | Espera 5 min más, prueba `/health` |
| `quality_score is NULL` | Validator no se ejecutó | Pasa `validation_config` en context |
| `Quarantine table empty` | Todos los datos fueron válidos | Prueba con EJEMPLO_VALIDACION.py |

---

## 📊 Métricas Esperadas (Post-Deploy)

Después de ejecutar el ejemplo, deberías ver:

| Métrica | Esperado |
|---------|----------|
| Total registros | 5 |
| Aceptados | 1 (20%) |
| Cuarentena | 2 (40%) |
| Rechazados | 2 (40%) |
| Errors registrados | 4+ |
| Tablas creadas | 3 (validation_errors, quarantine, validation_summary) |

---

## ✨ Cuándo Está Completo

Tu sistema de validación está **LISTO** cuando:

1. ✅ Migración ejecutada en Supabase (4 tablas creadas)
2. ✅ Backend deployado en Railway (health check responde)
3. ✅ Endpoints retornan data (sin errores 500)
4. ✅ Dashboard muestra estadísticas de validación
5. ✅ Panel de cuarentena permite revisar datos
6. ✅ Formularios usan `/validate` antes de guardar

---

## 🚀 Próximas 24 Horas (En Orden)

**Ahora (15 min):**
- [ ] Ejecuta migración SQL
- [ ] Push a GitHub (railway redeploy)
- [ ] Verifica `/health`

**Luego (30 min):**
- [ ] Ejecuta EJEMPLO_VALIDACION.py
- [ ] Verifica data en Supabase

**Después (1-2 horas):**
- [ ] Agrega componentes al dashboard
- [ ] Conecta formularios a /validate

**Opcional pero useful:**
- [ ] Configura webhooks para alertas críticas
- [ ] Crea reportes diarios de validación

---

## 📞 Si Hay Problemas

1. Revisa `VALIDATION_GUIDE.md` (troubleshooting section)
2. Verifica `RESUMEN_ENTREGA.md` (decisiones de diseño)
3. Consulta `EJEMPLO_VALIDACION.py` (implementación referencia)

---

**¡Listo para comenzar? Empieza por FASE 1 (Supabase).**
