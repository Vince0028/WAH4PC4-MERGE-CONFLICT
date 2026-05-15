-- ============================================
-- ADAPT iPaaS Database Schema (Supabase #3)
-- Run this in the iPaaS Supabase SQL Editor
-- ============================================
-- The iPaaS logs all data exchange transactions.
-- Safe to re-run (uses DROP IF EXISTS).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS adapt_transaction_logs CASCADE;

CREATE TABLE adapt_transaction_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_system VARCHAR(10) NOT NULL CHECK (source_system IN ('iHOMIS', 'WAH')),
  destination_system VARCHAR(10) NOT NULL CHECK (destination_system IN ('iHOMIS', 'WAH')),

  -- Input: HL7 v2 stored as { hl7v2_message: "MSH|...", format: "HL7v2" }
  --    or: FHIR Bundle stored as-is
  raw_payload JSONB NOT NULL,

  -- Output: Transformed data (FHIR Bundle or iHOMIS JSON)
  transformed_payload JSONB,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'TRANSFORMING', 'SUCCESS', 'QUARANTINED')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adapt_status ON adapt_transaction_logs (status);
CREATE INDEX IF NOT EXISTS idx_adapt_source ON adapt_transaction_logs (source_system);
CREATE INDEX IF NOT EXISTS idx_adapt_created ON adapt_transaction_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adapt_destination ON adapt_transaction_logs (destination_system);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_transaction_logs_modtime ON adapt_transaction_logs;
CREATE TRIGGER update_transaction_logs_modtime
  BEFORE UPDATE ON adapt_transaction_logs
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS (open for prototype)
ALTER TABLE adapt_transaction_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for prototype" ON adapt_transaction_logs
  FOR ALL USING (true) WITH CHECK (true);
