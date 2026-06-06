/**
 * App-wide data types, mirroring the database schema in PROJECT_CONTEXT.md.
 *
 * The frontend reads/writes these shapes. When the backend team finalizes the
 * Supabase schema, this file is the single place to reconcile field names so
 * screens don't need to change.
 *
 * Timestamps are UTC ISO strings (e.g. "2026-06-06T14:30:00Z").
 */

export type Role = 'patient' | 'caregiver';

export type RelationshipType = 'family' | 'clinician' | 'other';

export interface User {
  id: string;
  role: Role;
  display_name: string;
  avatar_url?: string | null;
}

export interface CareRelationship {
  caregiver_id: string;
  patient_id: string;
  relationship: RelationshipType;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Backend writes, frontend reads
// ---------------------------------------------------------------------------

/**
 * Relative spectral power per EEG frequency band (fractions that sum to ~1).
 * Streamed alongside the computed metrics so the frontend can render a live
 * spectrum without owning any metric formula (those stay backend-side).
 */
export interface BandPowers {
  delta: number; // 1–4 Hz   (deep slow waves)
  theta: number; // 4–8 Hz   (drowsiness)
  alpha: number; // 8–12 Hz  (relaxed wakefulness)
  beta: number; // 12–30 Hz  (active focus)
  gamma: number; // 30+ Hz   (high-level processing)
}

export interface EegSegment {
  id: string;
  patient_id: string;
  device_id: string;
  timestamp_start: string;
  duration_s: number;
  fatigue: number; // 0.0–1.0
  attention: number; // 0.0–1.0
  mood: number; // 0.0–1.0  (live DB column)
  anomaly_score: number; // 0.0–1.0
  // 2D UMAP projection of the embedding; null until backend has run UMAP.
  umap_x: number | null;
  umap_y: number | null;
  // `embedding` (pgvector) is intentionally omitted — frontend never reads it.
  //
  // TODO(backend): align the DB with the display layer — migrate `mood` ->
  // `relaxation` and add `band_powers: BandPowers` (raw spectral power the
  // frontend already renders). Until then the UI shows a `relaxation` tile
  // from WellnessMetrics and band powers are mocked (see `bandPowersFor`).
}

export type EventType = 'anomaly' | 'manual' | 'scheduled';
export type Severity = 'low' | 'medium' | 'high';

export interface MonitoringEvent {
  id: string;
  patient_id: string;
  segment_id: string;
  triggered_at: string;
  type: EventType;
  severity: Severity;
  resolved: boolean;
  resolved_at?: string | null;
}

export type ExtractionMethod = 'llm_auto' | 'caregiver_manual';

export interface Label {
  id: string;
  patient_id: string;
  segment_id: string;
  event_id: string;
  activity: string;
  medications: string[];
  subjective_state: string;
  event_type: string;
  resolution: string;
  extraction_method: ExtractionMethod;
  confidence: number; // 0.0–1.0
  confirmed_by_caregiver: boolean;
  confirmed_at?: string | null;
}

// ---------------------------------------------------------------------------
// Frontend writes, backend reads
// ---------------------------------------------------------------------------

export type CheckinResponseValue = 'ok' | 'not_great' | 'help';

export interface CheckinResponse {
  id: string;
  patient_id: string;
  event_id: string;
  response: CheckinResponseValue;
  voice_note_url?: string | null;
  created_at: string;
}

export type ActivityType =
  | 'sleeping'
  | 'eating'
  | 'walking'
  | 'resting'
  | 'social'
  | 'other';

export interface ActivityLog {
  id: string;
  patient_id: string;
  activity: ActivityType;
  created_at: string;
}

export interface MedicationLog {
  id: string;
  patient_id: string;
  medication_name: string;
  taken_at: string;
}

export interface Message {
  id: string;
  patient_id: string;
  caregiver_id: string;
  sender_id: string;
  content?: string | null;
  voice_note_url?: string | null;
  created_at: string;
}

export type Platform = 'ios' | 'android' | 'web';

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: Platform;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// UI-derived helpers (not stored — computed in the app)
// ---------------------------------------------------------------------------

/** The three headline wellness metrics, expressed on a 0–100 scale for display. */
export interface WellnessMetrics {
  fatigue: number; // 0–100
  attention: number; // 0–100
  relaxation: number; // 0–100
}
