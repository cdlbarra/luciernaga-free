# Luciérnaga MVP — Stack Gratuito

Réplica exacta del MVP en stack 100% gratuito.

## Servicios

| Componente     | Original      | Stack gratuito          |
|----------------|---------------|-------------------------|
| Ingestor v2    | Cloud Run     | Railway (mismo Dockerfile) |
| Publicador     | Cloud Run     | Vercel Functions        |
| Dashboard      | Local         | Vercel                  |
| Base de datos  | Firestore/GCS | Supabase Postgres       |
| CI/CD          | GitHub Actions| GitHub Actions (mismo)  |

## Setup en 4 pasos

### 1. Supabase
Ejecutar `supabase/migrations/001_initial.sql` en Dashboard > SQL Editor.

### 2. Railway (ingestor)
```bash
cd ingestor
railway login && railway init
railway up --service ingestor-v2
railway variables set SUPABASE_URL=... SUPABASE_KEY=...
```

### 3. Vercel (dashboard + publicador)
```bash
cd dashboard
vercel --prod
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
```

### 4. GitHub Secrets
```
RAILWAY_TOKEN · VERCEL_TOKEN · VERCEL_ORG_ID · VERCEL_PROJECT_ID
SUPABASE_URL  · SUPABASE_SERVICE_KEY
```

## Tests
```bash
cd ingestor && pytest tests/ -v   # 5/5, quality >= 73%
```
