-- Luciérnaga MVP — migración inicial Supabase
-- Ejecutar en: Dashboard > SQL Editor

create table if not exists ingestors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contract      jsonb not null,
  source_type   text generated always as (contract->>'source_type') stored,
  status        text not null default 'active',
  quality_score int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists pipeline_runs (
  id            uuid primary key default gen_random_uuid(),
  ingestor_id   uuid references ingestors(id) on delete cascade,
  report        jsonb,
  quality_score int check (quality_score between 0 and 100),
  duration_ms   int,
  created_at    timestamptz not null default now()
);

create index on ingestors(status);
create index on ingestors(source_type);
create index on pipeline_runs(ingestor_id);
create index on pipeline_runs(created_at desc);

-- RLS
alter table ingestors enable row level security;
alter table pipeline_runs enable row level security;
create policy "service_role_all" on ingestors for all using (true);
create policy "service_role_all" on pipeline_runs for all using (true);
