-- Luciérnaga MVP — Sistema de validación en 3 capas
-- Crear tablas para errores y cuarentena

-- Tabla de errores de validación
CREATE TABLE IF NOT EXISTS validation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestor_id UUID NOT NULL REFERENCES ingestors(id) ON DELETE CASCADE,
  raw_data_id UUID REFERENCES raw_data(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL CHECK (error_type IN (
    'missing_value',
    'type_mismatch',
    'format_invalid',
    'range_violation',
    'duplicate',
    'inconsistency',
    'critical'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  field_name TEXT,
  field_value TEXT,
  expected_type TEXT,
  expected_format TEXT,
  error_message TEXT NOT NULL,
  action_taken TEXT CHECK (action_taken IN ('accepted', 'rejected', 'quarantined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_validation_errors_ingestor ON validation_errors(ingestor_id);
CREATE INDEX idx_validation_errors_severity ON validation_errors(severity);
CREATE INDEX idx_validation_errors_type ON validation_errors(error_type);
CREATE INDEX idx_validation_errors_date ON validation_errors(created_at DESC);

-- Tabla de cuarentena (datos rechazados pero guardados para revisión)
CREATE TABLE IF NOT EXISTS quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestor_id UUID NOT NULL REFERENCES ingestors(id) ON DELETE CASCADE,
  raw_data_id UUID REFERENCES raw_data(id) ON DELETE CASCADE,
  original_data JSONB NOT NULL,
  quarantine_reason TEXT NOT NULL,
  error_details JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  action TEXT CHECK (action IN ('accept', 'reject', 'discard')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quarantine_ingestor ON quarantine(ingestor_id);
CREATE INDEX idx_quarantine_status ON quarantine(status);
CREATE INDEX idx_quarantine_date ON quarantine(created_at DESC);

-- Tabla de resumen de validación (para estadísticas)
CREATE TABLE IF NOT EXISTS validation_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestor_id UUID NOT NULL REFERENCES ingestors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_records INT DEFAULT 0,
  valid_records INT DEFAULT 0,
  records_with_warnings INT DEFAULT 0,
  records_with_errors INT DEFAULT 0,
  critical_errors INT DEFAULT 0,
  quarantined_records INT DEFAULT 0,
  acceptance_rate FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ingestor_id, date)
);

CREATE INDEX idx_validation_summary_ingestor ON validation_summary(ingestor_id);
CREATE INDEX idx_validation_summary_date ON validation_summary(date DESC);

-- Actualizar tabla raw_data para marcar el estado final
ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS final_status TEXT CHECK (final_status IN ('valid', 'warning', 'error', 'quarantined', 'rejected'));
ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS quality_score INT CHECK (quality_score BETWEEN 0 AND 100);
ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;
ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS warning_count INT DEFAULT 0;
