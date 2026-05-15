// ============================================
// ADAPT iPaaS Types
// Transaction logs, API contracts, enums
// ============================================

export type TransactionStatus = 'PENDING' | 'TRANSFORMING' | 'SUCCESS' | 'QUARANTINED';
export type SourceSystem = 'iHOMIS' | 'WAH';

/**
 * Transaction Log — Maps to the adapt_transaction_logs Supabase table
 */
export interface TransactionLog {
  id: string;
  source_system: SourceSystem;
  destination_system: SourceSystem;
  raw_payload: Record<string, unknown>;
  transformed_payload: Record<string, unknown> | null;
  status: TransactionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ingestion Request — What external systems POST to the iPaaS
 */
export interface IngestRequest {
  source_system: SourceSystem;
  destination_system: SourceSystem;
  payload: Record<string, unknown>;
}

/**
 * Ingestion Response — What the iPaaS returns after accepting data
 */
export interface IngestResponse {
  success: boolean;
  transaction_id: string;
  status: TransactionStatus;
  message: string;
}

/**
 * Dashboard Metrics — Aggregated stats for the admin dashboard
 */
export interface DashboardMetrics {
  total_records: number;
  success_count: number;
  pending_count: number;
  quarantined_count: number;
  transforming_count: number;
  success_rate: number;           // Percentage 0-100
  ihomis_to_wah: number;
  wah_to_ihomis: number;
}

/**
 * Transformation Direction
 */
export type TransformDirection = 'IHOMIS_TO_FHIR' | 'FHIR_TO_IHOMIS';
