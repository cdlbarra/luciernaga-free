CREATE TABLE IF NOT EXISTS raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestor_id UUID NOT NULL REFERENCES ingestors(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  uploaded_by TEXT NOT NULL,
  company TEXT NOT NULL,
  data_type TEXT CHECK (data_type IN ('raw', 'processed')),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ingestor_id, uploaded_at)
);

CREATE INDEX idx_raw_data_user ON raw_data(uploaded_by);
CREATE INDEX idx_raw_data_company ON raw_data(company);
CREATE INDEX idx_raw_data_ingestor ON raw_data(ingestor_id);
