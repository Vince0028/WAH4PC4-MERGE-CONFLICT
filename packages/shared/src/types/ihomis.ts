// ============================================
// iHOMIS Legacy Data Format
// Proprietary flat JSON used by DOH hospitals
// ============================================

/**
 * iHOMIS Patient Referral — Legacy format
 * This is the proprietary, non-FHIR format used by the
 * Department of Health's Integrated Hospital Operations
 * and Management Information System (iHOMIS).
 */
export interface IHOMISPatientReferral {
  // --- Patient Demographics ---
  patient_fname: string;
  patient_lname: string;
  patient_mname: string;
  patient_suffix?: string;        // Jr, Sr, III, etc.
  dob: string;                    // YYYY-MM-DD
  sex: 'M' | 'F';
  civil_status: 'S' | 'M' | 'W' | 'D' | 'SEP'; // Single, Married, Widowed, Divorced, Separated
  philhealth_no: string;          // PhilHealth member ID
  contact_no: string;
  address_street: string;
  address_barangay: string;
  address_city: string;
  address_province: string;
  address_zip: string;

  // --- Vitals (taken at time of referral) ---
  vitals: IHOMISVitals;

  // --- Diagnosis & Clinical Info ---
  chief_complaint: string;
  diagnosis_code: string;         // ICD-10 code
  diagnosis_desc: string;
  diagnosis_type: 'admitting' | 'final' | 'working';
  clinical_notes?: string;

  // --- Referral Info ---
  referring_facility_code: string; // DOH facility code
  referring_facility_name: string;
  referring_physician: string;
  referring_physician_license: string; // PRC license number
  referral_date: string;          // ISO 8601
  referral_reason: string;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
}

export interface IHOMISVitals {
  bp_systolic: number;            // mmHg
  bp_diastolic: number;           // mmHg
  heart_rate: number;             // bpm
  temperature: number;            // Celsius
  respiratory_rate: number;       // breaths/min
  oxygen_saturation?: number;     // SpO2 %
  weight_kg: number;
  height_cm: number;
}

/**
 * iHOMIS Incoming Record — What iHOMIS receives
 * after PaaS transforms a WAH FHIR bundle back to legacy format
 */
export interface IHOMISIncomingRecord {
  id: string;
  received_at: string;
  source_facility: string;
  patient: IHOMISPatientReferral;
  transaction_id: string;         // iPaaS transaction reference
}
