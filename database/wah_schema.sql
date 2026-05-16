-- ============================================
-- WAH Hospital Database Schema (Supabase #2)
-- Run this in the WAH Supabase SQL Editor
-- ============================================
-- WAH uses PH Core HL7 FHIR R4 for data exchange.
-- The full FHIR Bundle is stored as JSONB.
-- Safe to re-run (uses DROP IF EXISTS).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS wah_patients CASCADE;

CREATE TABLE wah_patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Extracted metadata (for search/display)
  patient_name VARCHAR(200),
  philhealth_no VARCHAR(30),
  gender VARCHAR(10),
  birth_date DATE,
  diagnosis_code VARCHAR(20),
  diagnosis_display TEXT,

  -- Full FHIR R4 Bundle (Patient, Encounter, Observation, Condition)
  fhir_bundle JSONB NOT NULL,

  -- Raw source payload (original data before transformation, for comparison)
  raw_source_payload JSONB,

  -- Patient data privacy consent (RA 10173)
  consent_signed BOOLEAN DEFAULT FALSE,

  -- Record tracking
  status VARCHAR(20) DEFAULT 'SAVED' CHECK (status IN ('SAVED', 'QUEUED', 'SENT', 'RECEIVED', 'REJECTED')),
  source VARCHAR(20) DEFAULT 'LOCAL' CHECK (source IN ('LOCAL', 'RECEIVED')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wah_status ON wah_patients (status);
CREATE INDEX IF NOT EXISTS idx_wah_source ON wah_patients (source);
CREATE INDEX IF NOT EXISTS idx_wah_created ON wah_patients (created_at DESC);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_wah_patients_modtime ON wah_patients;
CREATE TRIGGER update_wah_patients_modtime
  BEFORE UPDATE ON wah_patients
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS (open for prototype)
ALTER TABLE wah_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for prototype" ON wah_patients FOR ALL USING (true) WITH CHECK (true);
