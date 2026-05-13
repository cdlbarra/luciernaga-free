ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS validation_report JSONB;
ALTER TABLE raw_data ADD COLUMN IF NOT EXISTS validation_status TEXT CHECK (validation_status IN ('valid', 'warnings', 'errors'));
