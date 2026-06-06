/**
 * Mock data for building and demoing the UI without a backend.
 *
 * Everything here is fake but shaped exactly like the real schema in
 * `@/types`. When Supabase is wired up, screens should swap these fixtures for
 * live queries without changing their rendering code.
 */

import { StatusLevel } from '@/theme';
import {
  ActivityLog,
  CheckinResponse,
  Label,
  Message,
  MedicationLog,
  MonitoringEvent,
  User,
  WellnessMetrics,
} from '@/types';

/** Minutes/hours ago as a UTC ISO string, relative to now. */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const CURRENT_CAREGIVER: User = {
  id: 'c1',
  role: 'caregiver',
  display_name: 'Dr. Mei Nguyen',
  avatar_url: null,
};

/** The patient who is "logged in" when previewing the patient view. */
export const CURRENT_PATIENT_ID = 'p1';

export interface PatientSummary {
  user: User;
  status: StatusLevel;
  metrics: WellnessMetrics;
  lastUpdated: string; // ISO
  hasUnacknowledgedAlert: boolean;
  relationship: string;
}

export const PATIENTS: PatientSummary[] = [
  {
    user: { id: 'p1', role: 'patient', display_name: 'Margaret Chen', avatar_url: null },
    status: 'warn',
    metrics: { fatigue: 68, attention: 54, mood: 47 },
    lastUpdated: minutesAgo(3),
    hasUnacknowledgedAlert: true,
    relationship: 'Patient',
  },
  {
    user: { id: 'p2', role: 'patient', display_name: 'Harold Müller', avatar_url: null },
    status: 'good',
    metrics: { fatigue: 22, attention: 81, mood: 76 },
    lastUpdated: minutesAgo(11),
    hasUnacknowledgedAlert: false,
    relationship: 'Patient',
  },
  {
    user: { id: 'p3', role: 'patient', display_name: 'Sofia Rossi', avatar_url: null },
    status: 'bad',
    metrics: { fatigue: 84, attention: 38, mood: 31 },
    lastUpdated: minutesAgo(1),
    hasUnacknowledgedAlert: true,
    relationship: 'Patient',
  },
];

export const patientById = (id: string): PatientSummary | undefined =>
  PATIENTS.find((p) => p.user.id === id);

/** The patient object used by the patient-facing screens. */
export const CURRENT_PATIENT = patientById(CURRENT_PATIENT_ID)!;

// ---------------------------------------------------------------------------
// Wellness timeline (last ~12 hours, oldest → newest)
// ---------------------------------------------------------------------------

export interface TimelinePoint extends WellnessMetrics {
  t: string; // ISO timestamp
}

export const timelineFor = (patientId: string): TimelinePoint[] => {
  // Deterministic pseudo-series so the chart looks plausible per patient.
  const seed = patientId.charCodeAt(1) || 1;
  return Array.from({ length: 12 }).map((_, i) => {
    const wobble = Math.sin((i + seed) / 2) * 18;
    return {
      t: hoursAgo(11 - i),
      fatigue: clamp(50 + wobble + seed * 3),
      attention: clamp(60 - wobble),
      mood: clamp(55 - wobble / 2),
    };
  });
};

const clamp = (n: number) => Math.max(2, Math.min(98, Math.round(n)));

// ---------------------------------------------------------------------------
// Events (anomaly alerts)
// ---------------------------------------------------------------------------

export const EVENTS: MonitoringEvent[] = [
  {
    id: 'e1',
    patient_id: 'p1',
    segment_id: 'seg1',
    triggered_at: minutesAgo(8),
    type: 'anomaly',
    severity: 'medium',
    resolved: false,
  },
  {
    id: 'e2',
    patient_id: 'p1',
    segment_id: 'seg9',
    triggered_at: hoursAgo(5),
    type: 'anomaly',
    severity: 'low',
    resolved: true,
    resolved_at: hoursAgo(4),
  },
  {
    id: 'e3',
    patient_id: 'p3',
    segment_id: 'seg14',
    triggered_at: minutesAgo(2),
    type: 'anomaly',
    severity: 'high',
    resolved: false,
  },
];

export const eventsForPatient = (patientId: string): MonitoringEvent[] =>
  EVENTS.filter((e) => e.patient_id === patientId).sort(
    (a, b) => +new Date(b.triggered_at) - +new Date(a.triggered_at),
  );

/** The most recent unresolved event for a patient, if any (drives check-in). */
export const activeEventForPatient = (patientId: string): MonitoringEvent | undefined =>
  eventsForPatient(patientId).find((e) => !e.resolved);

// ---------------------------------------------------------------------------
// Check-in responses
// ---------------------------------------------------------------------------

export const CHECKIN_RESPONSES: CheckinResponse[] = [
  {
    id: 'cr1',
    patient_id: 'p1',
    event_id: 'e2',
    response: 'not_great',
    created_at: hoursAgo(4),
  },
];

export const checkinForEvent = (eventId: string): CheckinResponse | undefined =>
  CHECKIN_RESPONSES.find((c) => c.event_id === eventId);

// ---------------------------------------------------------------------------
// Labels (auto-extracted, awaiting caregiver confirmation)
// ---------------------------------------------------------------------------

export const LABELS: Label[] = [
  {
    id: 'l1',
    patient_id: 'p1',
    segment_id: 'seg9',
    event_id: 'e2',
    activity: 'Resting on the sofa',
    medications: ['Amlodipine'],
    subjective_state: 'Reported feeling dizzy and a little lightheaded',
    event_type: 'Possible blood-pressure dip',
    resolution: 'Sat down, drank water, felt better after 20 minutes',
    extraction_method: 'llm_auto',
    confidence: 0.82,
    confirmed_by_caregiver: false,
  },
  {
    id: 'l2',
    patient_id: 'p3',
    segment_id: 'seg14',
    event_id: 'e3',
    activity: 'Walking to the kitchen',
    medications: [],
    subjective_state: 'Said she felt unsteady and needed to hold the wall',
    event_type: 'Balance / fall risk',
    resolution: 'Unresolved — caregiver follow-up needed',
    extraction_method: 'llm_auto',
    confidence: 0.74,
    confirmed_by_caregiver: false,
  },
];

export const labelsForPatient = (patientId: string): Label[] =>
  LABELS.filter((l) => l.patient_id === patientId);

export const labelForEvent = (eventId: string): Label | undefined =>
  LABELS.find((l) => l.event_id === eventId);

// ---------------------------------------------------------------------------
// Activity + medication logs (patient-authored)
// ---------------------------------------------------------------------------

export const ACTIVITY_LOGS: ActivityLog[] = [
  { id: 'a1', patient_id: 'p1', activity: 'eating', created_at: minutesAgo(45) },
  { id: 'a2', patient_id: 'p1', activity: 'resting', created_at: hoursAgo(2) },
  { id: 'a3', patient_id: 'p1', activity: 'walking', created_at: hoursAgo(4) },
  { id: 'a4', patient_id: 'p1', activity: 'sleeping', created_at: hoursAgo(9) },
];

export const MEDICATION_LOGS: MedicationLog[] = [
  { id: 'm1', patient_id: 'p1', medication_name: 'Amlodipine 5mg', taken_at: hoursAgo(1) },
  { id: 'm2', patient_id: 'p1', medication_name: 'Vitamin D', taken_at: hoursAgo(9) },
];

export const activityLogsForPatient = (patientId: string): ActivityLog[] =>
  ACTIVITY_LOGS.filter((l) => l.patient_id === patientId).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

export const medicationLogsForPatient = (patientId: string): MedicationLog[] =>
  MEDICATION_LOGS.filter((l) => l.patient_id === patientId).sort(
    (a, b) => +new Date(b.taken_at) - +new Date(a.taken_at),
  );

// ---------------------------------------------------------------------------
// Messages (patient <-> caregiver threads)
// ---------------------------------------------------------------------------

export const MESSAGES: Message[] = [
  {
    id: 'msg1',
    patient_id: 'p1',
    caregiver_id: 'c1',
    sender_id: 'c1',
    content: 'Hi Margaret, I saw an alert earlier. How are you feeling now?',
    created_at: hoursAgo(4),
  },
  {
    id: 'msg2',
    patient_id: 'p1',
    caregiver_id: 'c1',
    sender_id: 'p1',
    content: 'A bit better, thank you. The dizziness passed after I rested.',
    created_at: hoursAgo(3),
  },
  {
    id: 'msg3',
    patient_id: 'p1',
    caregiver_id: 'c1',
    sender_id: 'c1',
    content: 'Glad to hear it. Please remember to take your blood pressure tablet.',
    created_at: hoursAgo(3),
  },
];

export const messagesForThread = (patientId: string, caregiverId: string): Message[] =>
  MESSAGES.filter((m) => m.patient_id === patientId && m.caregiver_id === caregiverId).sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );

// EEG segments are no longer mocked — the Map tab reads them straight from
// Supabase (see src/hooks/useEegSegments). The seed script in scripts/seed_eeg.py
// derives real features + embeddings from data/sub-001_task-eyesclosed_eeg.set.
