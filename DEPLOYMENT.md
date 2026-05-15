# Deployment — Luciérnaga MVP

## Servicios

| Servicio | Plataforma | URL |
|---|---|---|
| Ingestor (FastAPI) | Render | https://luciernaga-ingestor-v2.onrender.com |
| Dashboard (Next.js) | Vercel | https://luciernaga-free-mutmsg5nc-cdlbarras-projects.vercel.app |
| Base de datos | Supabase | https://wtlyfndyuqibjzqxcztz.supabase.co |

---

## Variables de entorno

### Render — Ingestor API

En Render dashboard → `luciernaga-ingestor-v2` → Settings → Environment:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_KEY` | Clave `anon` o `service_role` de Supabase |
| `HF_TOKEN` | Token de HuggingFace (para chat) |

> Las variables con `sync: false` en `render.yaml` se configuran manualmente y nunca se commitean a Git.

### Vercel — Dashboard

En Vercel dashboard → proyecto → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_INGESTOR_URL` | `https://luciernaga-ingestor-v2.onrender.com` |

---

## Flujo de redeploy

### Render (automático al hacer push)
El `render.yaml` en la raíz configura el servicio. El comando de inicio es:
```
cd ingestor && uvicorn main:app --host 0.0.0.0 --port $PORT
```
Render asigna `$PORT` automáticamente — no usar un puerto fijo.

### Vercel (automático al hacer push a `main`)
El dashboard se despliega automáticamente. Para redeploy manual usar el botón en el panel de Vercel.

---

## Verificación post-deploy

```bash
# 1. Health check del ingestor
curl https://luciernaga-ingestor-v2.onrender.com/health
# Esperado: {"status":"ok","service":"ingestor"}

# 2. Listar ingestores
curl https://luciernaga-ingestor-v2.onrender.com/ingestores
# Esperado: [] o lista de ingestores

# 3. Dashboard
# Abrir en navegador y verificar en DevTools → Network que los requests
# vayan a https://luciernaga-ingestor-v2.onrender.com
```

---

## Notas importantes

- Render free tier tiene cold start de ~50 seg si el servicio estuvo inactivo
- Las credenciales NO se commitean a Git (están en `.gitignore`)
- El archivo `server.py` en `/ingestor/` es legacy — el app activo es `main.py`
