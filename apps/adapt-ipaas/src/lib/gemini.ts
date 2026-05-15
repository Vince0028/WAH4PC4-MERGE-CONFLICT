import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model fallback chain — if one model hits quota, try the next
const MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-3.1-flash-lite',   // 500 RPD — highest free quota
  'gemini-2.5-flash-lite',   // 20 RPD
  'gemini-2.5-flash',        // 20 RPD
  'gemini-3-flash',          // 20 RPD
  'gemini-2.0-flash',        // fallback
];

const HL7V2_TO_FHIR_PROMPT = `You are a healthcare data transformation engine for the Philippine Local Health Information Exchange (LHIE).

Your task: Convert the following HL7 v2.x message (pipe-delimited segments: MSH, PID, PV1, OBX, DG1, RF1) into a FULLY VALID PH Core HL7 FHIR R4 Transaction Bundle.

HL7 v2 segment reference:
- MSH: Message Header (sending facility, timestamp)
- PID: Patient ID, name (format: LASTNAME^FIRSTNAME^MIDDLENAME), DOB, sex, address, PhilHealth number
- PV1: Patient Visit (class, attending physician, priority)
- OBX: Observation (vital signs with LOINC codes)
- DG1: Diagnosis (ICD-10 code, description)
- RF1: Referral info (priority, reason, facility)

The output FHIR Bundle MUST contain:
1. **Patient** — PH Core Patient profile with PhilHealth identifier (system: "https://www.philhealth.gov.ph/memberid"), meta profile: "http://fhir.ph/StructureDefinition/ph-core-patient"
2. **Encounter** — with status, class, priority, participant, serviceProvider
3. **Observation** resources for each OBX segment (vital signs with LOINC codes, units of measure)
4. **Condition** — from DG1 segment with ICD-10 coding

Bundle: type "transaction", fullUrl using "urn:uuid:" format, request with method "POST".
Output ONLY valid JSON. No markdown, no code fences, no explanation.`;

const FHIR_TO_HL7V2_PROMPT = `You are a healthcare data transformation engine for the Philippine Local Health Information Exchange (LHIE).

Your task: Convert the following PH Core HL7 FHIR R4 Bundle into iHOMIS-compatible flat JSON format that can be stored in the iHOMIS database.

Extract data from the FHIR Bundle resources (Patient, Encounter, Observation, Condition) and map them to this EXACT structure:

{
  "patient_fname": "from Patient.name[0].given[0]",
  "patient_lname": "from Patient.name[0].family",
  "patient_mname": "from Patient.name[0].given[1] or empty string",
  "patient_suffix": "from Patient.name[0].suffix[0] or empty string",
  "dob": "Patient.birthDate in YYYY-MM-DD",
  "sex": "M or F from Patient.gender (male=M, female=F)",
  "civil_status": "S/M/W/D from Patient.maritalStatus",
  "philhealth_no": "from Patient.identifier where system contains philhealth",
  "contact_no": "from Patient.telecom where system is phone",
  "address_street": "from Patient.address[0].line[0]",
  "address_barangay": "from Patient.address[0].line[1] or empty",
  "address_city": "from Patient.address[0].city",
  "address_province": "from Patient.address[0].district",
  "address_zip": "from Patient.address[0].postalCode",
  "vitals": {
    "bp_systolic": "number from BP component LOINC 8480-6",
    "bp_diastolic": "number from BP component LOINC 8462-4",
    "heart_rate": "number from LOINC 8867-4",
    "temperature": "number from LOINC 8310-5",
    "respiratory_rate": "number from LOINC 9279-1",
    "oxygen_saturation": "number from LOINC 2708-6 or null",
    "weight_kg": "number from LOINC 29463-7",
    "height_cm": "number from LOINC 8302-2"
  },
  "chief_complaint": "from Condition.note or Encounter.reasonCode",
  "diagnosis_code": "ICD-10 code from Condition.code.coding",
  "diagnosis_desc": "display from Condition.code",
  "diagnosis_type": "admitting/final/working from Condition.verificationStatus",
  "referring_facility_code": "from Encounter.serviceProvider or generate",
  "referring_facility_name": "from Encounter.serviceProvider display",
  "referring_physician": "from Encounter.participant display",
  "referring_physician_license": "from identifier or empty",
  "referral_reason": "from Encounter.reasonCode text",
  "priority": "ROUTINE/URGENT/EMERGENCY from Encounter.priority"
}

All numeric vitals must be numbers, not strings. Missing fields should use empty string or 0.
Output ONLY valid JSON. No markdown, no code fences, no explanation.`;

/**
 * Transform data using Gemini AI with automatic model fallback.
 * If a model hits quota (429), it tries the next model in the chain.
 */
export async function transformWithGemini(
  payload: unknown,
  direction: 'IHOMIS_TO_FHIR' | 'FHIR_TO_IHOMIS'
): Promise<{ success: boolean; data: Record<string, unknown> | null; error: string | null }> {
  const systemPrompt = direction === 'IHOMIS_TO_FHIR' 
    ? HL7V2_TO_FHIR_PROMPT 
    : FHIR_TO_HL7V2_PROMPT;

  const inputData = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload, null, 2);

  const prompt = `${systemPrompt}\n\nInput Data:\n${inputData}`;

  // Deduplicate model list while preserving order
  const models = [...new Set(MODEL_FALLBACKS)];

  for (const modelName of models) {
    try {
      console.log(`[Gemini] Trying model: ${modelName} for ${direction}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText);

      console.log(`[Gemini] Transformation successful using ${modelName}`);
      return { success: true, data: parsedData, error: null };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = errorMessage.includes('429') || errorMessage.includes('503') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Service Unavailable') || errorMessage.includes('high demand');

      if (isRetryable) {
        console.warn(`[Gemini] Model ${modelName} unavailable (quota/503), trying next...`);
        continue; // Try next model
      }

      // Non-quota error — stop trying
      console.error(`[Gemini] Error with ${modelName}:`, errorMessage);
      return { success: false, data: null, error: `Transformation failed: ${errorMessage}` };
    }
  }

  // All models exhausted
  return {
    success: false,
    data: null,
    error: 'All Gemini models quota exhausted. Please wait for quota reset or add a new API key.',
  };
}
