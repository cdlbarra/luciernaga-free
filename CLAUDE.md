# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luciérnaga MVP** is a free-tier data ingestion pipeline with three deployed services:

| Service | Technology | Platform |
|---|---|---|
| Dashboard | Next.js 14 (App Router) | Vercel |
| Ingestor v2 | Python FastAPI | Railway |
| Publicador | Vercel Functions | Vercel |
| Database | PostgreSQL | Supabase |

## Commands

### Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev      # localhost:3000
npm run build
npm run start
```

### Ingestor (Python FastAPI)
```bash
cd ingestor
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

### Tests
```bash
cd ingestor && pytest tests/ -v    # 5 pipeline tests, quality threshold >= 73%
```

There are no frontend tests.

## Architecture

### Data Flow
1. User registers an ingestor via **IngestorModal** → `POST /api/publish` (Next.js handler) → Supabase `ingestors` table
2. Ingestor pipeline is triggered via `POST /ingest` on the Railway FastAPI service
3. Pipeline runs through 10 modules in `/ingestor/modules/` (reader, profiler, cleaner, validator, normalizer, metadata, reporter, notifier, loader)
4. Results stored in Supabase `pipeline_runs` table; quality score written back to `ingestors`
5. Dashboard fetches ingestor details via `GET /api/ingestors/[id]` (Next.js proxies to Supabase)

### Dashboard Structure (`/dashboard/src/`)
- `app/page.tsx` — main dashboard page; all primary state lives here
- `app/api/chat/route.ts` — proxies to HuggingFace (`meta-llama/Meta-Llama-3-8B-Instruct`)
- `app/api/publish/route.ts` — CRUD for `ingestors` table via Supabase
- `app/api/ingestors/[id]/route.ts` — fetches ingestor + pipeline run details
- `components/` — `Chat`, `IngestorModal`, `IngestorStatus`, `IngestorDetail`, `PipelineFlow` (xyflow), `MermaidChart`
- `hooks/useIngestor.ts` — wraps calls to the Railway ingestor API

### Ingestor Structure (`/ingestor/`)
- `server.py` — FastAPI app: `/ingestores`, `/chat/guardar-mensaje`, `/chat/historial/{usuario_id}`, `/health`
- `main.py` — pipeline orchestration entry point
- `modules/` — 10 pipeline stage modules (currently stub implementations)

### Database Schema (`/supabase/migrations/001_initial.sql`)
- `ingestors` — id, name, contract (jsonb), source_type, status, quality_score
- `pipeline_runs` — id, ingestor_id (FK), report (jsonb), quality_score, duration_ms
- `chat_historial` — chat message persistence
- RLS: `service_role_all` policy (backend uses service key)

## Environment Variables

Copy `.env.example`. Required vars:

```
# Supabase
SUPABASE_URL
SUPABASE_KEY                    # service key (backend)
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# LLM (at least one required for chat)
HF_TOKEN                        # HuggingFace — used in /api/chat
OPENAI_API_KEY                  # optional
GOOGLE_GENERATIVE_AI_API_KEY    # optional

# Deployment
NEXT_PUBLIC_INGESTOR_URL        # Railway URL; defaults to http://localhost:8000
PORT                            # Railway port, default 8080
```

## Key Conventions

- All UI text, variable names, and comments are in **Spanish**
- Styling uses inline CSS — no CSS framework
- Next.js API routes act as a proxy/BFF between the React frontend and Supabase/Railway
- The `contract` field in `ingestors` is free-form JSONB holding the full ingestor configuration
- CI/CD via `.github/workflows/deploy.yml`: runs `pytest` then deploys to Railway + Vercel
