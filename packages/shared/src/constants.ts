// ============================================
// Shared Constants
// ============================================

export const SYSTEM_NAMES = {
  IHOMIS: 'iHOMIS' as const,
  WAH: 'WAH' as const,
} as const;

export const STATUS = {
  PENDING: 'PENDING' as const,
  TRANSFORMING: 'TRANSFORMING' as const,
  SUCCESS: 'SUCCESS' as const,
  QUARANTINED: 'QUARANTINED' as const,
} as const;

export const ENDPOINTS = {
  IPAAS_INGEST: '/api/ingest',
  IPAAS_TRANSFORM: '/api/transform',
  IPAAS_TRANSACTIONS: '/api/transactions',
  IPAAS_METRICS: '/api/metrics',
  IHOMIS_WEBHOOK: '/api/webhook',
  WAH_WEBHOOK: '/api/webhook',
} as const;

/**
 * FHIR System URIs used in PH Core
 */
export const FHIR_SYSTEMS = {
  PHILHEALTH: 'https://www.philhealth.gov.ph/memberid',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  LOINC: 'http://loinc.org',
  ENCOUNTER_CLASS: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  CONDITION_CLINICAL: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  CONDITION_VERIFICATION: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
  OBSERVATION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  PH_CORE_PATIENT: 'http://fhir.ph/StructureDefinition/ph-core-patient',
} as const;
