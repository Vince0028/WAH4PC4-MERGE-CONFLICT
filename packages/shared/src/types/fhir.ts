// ============================================
// PH Core HL7 FHIR R4 Resource Types
// Aligned with Philippine Core Implementation Guide
// ============================================

// --- FHIR Primitives ---

export interface FHIRCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value: string;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family: string;
  given: string[];               // given[0] = first name, given[1] = middle name (PH Core)
  suffix?: string[];
  prefix?: string[];
  text?: string;
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;             // Maps to province in PH context
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  display?: string;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

export interface FHIRQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  profile?: string[];
}

// --- FHIR Resources ---

/**
 * PH Core Patient Resource
 * Profile: http://fhir.ph/StructureDefinition/ph-core-patient
 */
export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];   // PhilHealth ID with system "https://www.philhealth.gov.ph/memberid"
  name: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;               // YYYY-MM-DD
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  extension?: FHIRExtension[];
}

export interface FHIRExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueCoding?: FHIRCoding;
  valueCodeableConcept?: FHIRCodeableConcept;
}

/**
 * FHIR Encounter Resource
 * Represents the patient referral encounter
 */
export interface FHIREncounter {
  resourceType: 'Encounter';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: FHIRCoding;               // AMB, IMP, EMER, etc.
  type?: FHIRCodeableConcept[];
  priority?: FHIRCodeableConcept;
  subject: FHIRReference;          // Reference to Patient
  period?: FHIRPeriod;
  reasonCode?: FHIRCodeableConcept[];
  serviceProvider?: FHIRReference;
  participant?: FHIREncounterParticipant[];
}

export interface FHIREncounterParticipant {
  type?: FHIRCodeableConcept[];
  individual?: FHIRReference;
  period?: FHIRPeriod;
}

/**
 * FHIR Observation Resource
 * Used for vitals: BP, HR, Temp, RR, SpO2, Weight, Height
 */
export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;        // LOINC code for the vital sign
  subject: FHIRReference;           // Reference to Patient
  encounter?: FHIRReference;        // Reference to Encounter
  effectiveDateTime?: string;
  valueQuantity?: FHIRQuantity;
  component?: FHIRObservationComponent[]; // For BP (systolic/diastolic)
}

export interface FHIRObservationComponent {
  code: FHIRCodeableConcept;
  valueQuantity?: FHIRQuantity;
}

/**
 * FHIR Condition Resource
 * Represents a diagnosis (ICD-10 coded)
 */
export interface FHIRCondition {
  resourceType: 'Condition';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  clinicalStatus: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;        // ICD-10 coding
  subject: FHIRReference;           // Reference to Patient
  encounter?: FHIRReference;        // Reference to Encounter
  onsetDateTime?: string;
  recordedDate?: string;
  note?: FHIRAnnotation[];
}

export interface FHIRAnnotation {
  text: string;
  time?: string;
  authorString?: string;
}

/**
 * FHIR Bundle — Transaction Bundle
 * Wraps all resources into a single payload
 */
export interface FHIRBundle {
  resourceType: 'Bundle';
  id?: string;
  meta?: FHIRMeta;
  type: 'transaction' | 'collection' | 'document' | 'message' | 'searchset';
  timestamp?: string;
  entry: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
  fullUrl?: string;
  resource: FHIRPatient | FHIREncounter | FHIRObservation | FHIRCondition;
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
  };
}

// --- LOINC Vital Sign Codes (Constants) ---

export const LOINC_VITALS = {
  BLOOD_PRESSURE: { code: '85354-9', display: 'Blood pressure panel with all children optional' },
  BP_SYSTOLIC: { code: '8480-6', display: 'Systolic blood pressure' },
  BP_DIASTOLIC: { code: '8462-4', display: 'Diastolic blood pressure' },
  HEART_RATE: { code: '8867-4', display: 'Heart rate' },
  TEMPERATURE: { code: '8310-5', display: 'Body temperature' },
  RESPIRATORY_RATE: { code: '9279-1', display: 'Respiratory rate' },
  OXYGEN_SATURATION: { code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
  BODY_WEIGHT: { code: '29463-7', display: 'Body weight' },
  BODY_HEIGHT: { code: '8302-2', display: 'Body height' },
} as const;
