-- Luciérnaga MVP — Tabla de datos transformados
-- Ejecutar en: Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS transformed_data (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestor_id    UUID NOT NULL REFERENCES ingestores(id) ON DELETE CASCADE,
  raw_data_id    UUID NOT NULL REFERENCES raw_data(id) ON DELETE CASCADE,
  data           JSONB NOT NULL,
  metadata       JSONB NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transformed_ingestor ON transformed_data(ingestor_id);
CREATE INDEX idx_transformed_raw      ON transformed_data(raw_data_id);
CREATE INDEX idx_transformed_created  ON transformed_data(created_at DESC);

ALTER TABLE transformed_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON transformed_data FOR ALL USING (true);
