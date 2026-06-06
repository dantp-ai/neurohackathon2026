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
  BandPowers,
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

// ---------------------------------------------------------------------------
// 1–5 scoring (5 = best). Metrics are stored 0–100; we display them on a simple
// 1–5 scale where 1 is worst and 5 is best. Fatigue is inverted (more fatigued
// = worse = lower score).
// ---------------------------------------------------------------------------

/** Continuous 1–5 score (good for smooth line charts). `invert` for fatigue. */
export const scoreOf = (value: number, invert = false): number => {
  const goodness = invert ? 100 - value : value;
  return Math.max(1, Math.min(5, 1 + (goodness / 100) * 4));
};

/** Rounded 1–5 score for tiles. */
export const tileScore = (value: number, invert = false): number =>
  Math.round(scoreOf(value, invert));

export interface MetricScores {
  fatigue: number;
  attention: number;
  relaxation: number;
}

export const scoresFor = (m: WellnessMetrics): MetricScores => ({
  fatigue: tileScore(m.fatigue, true),
  attention: tileScore(m.attention),
  relaxation: tileScore(m.relaxation),
});

/**
 * A patient's overall condition is derived from their metric scores: we take
 * the average of the three 1–5 scores. >= 3.5 → good, >= 2.5 → watch, else
 * urgent. (This is what "determines the condition" on the caregiver list.)
 */
export const deriveStatus = (m: WellnessMetrics): StatusLevel => {
  const s = scoresFor(m);
  const avg = (s.fatigue + s.attention + s.relaxation) / 3;
  return avg >= 3.5 ? 'good' : avg >= 2.5 ? 'warn' : 'bad';
};

const mk = (
  user: User,
  metrics: WellnessMetrics,
  lastUpdated: string,
  hasUnacknowledgedAlert: boolean,
): PatientSummary => ({
  user,
  metrics,
  lastUpdated,
  hasUnacknowledgedAlert,
  status: deriveStatus(metrics),
  relationship: 'Patient',
});

export const PATIENTS: PatientSummary[] = [
  mk(
    { id: 'p1', role: 'patient', display_name: 'Margaret Chen', avatar_url: null },
    { fatigue: 68, attention: 54, relaxation: 42 },
    minutesAgo(3),
    true,
  ),
  mk(
    { id: 'p2', role: 'patient', display_name: 'Harold Müller', avatar_url: null },
    { fatigue: 22, attention: 81, relaxation: 58 },
    minutesAgo(11),
    false,
  ),
  mk(
    { id: 'p3', role: 'patient', display_name: 'Sofia Rossi', avatar_url: null },
    { fatigue: 84, attention: 38, relaxation: 30 },
    minutesAgo(1),
    true,
  ),
  // Live neurodsp stream target (see pipeline/controller.py / `npm run stream`).
  mk(
    { id: 'p4', role: 'patient', display_name: 'Live Monitor', avatar_url: null },
    { fatigue: 50, attention: 50, relaxation: 50 },
    minutesAgo(0),
    false,
  ),
];

export const patientById = (id: string): PatientSummary | undefined =>
  PATIENTS.find((p) => p.user.id === id);

/** The patient object used by the patient-facing screens. */
export const CURRENT_PATIENT = patientById(CURRENT_PATIENT_ID)!;

// ---------------------------------------------------------------------------
// Wellness timeline — last hour (sliding window), oldest → newest.
// Values are continuous 1–5 scores (5 = best) so the line chart is smooth.
// ---------------------------------------------------------------------------

export interface TimelinePoint {
  t: string; // ISO timestamp
  fatigue: number; // 1–5 score
  attention: number; // 1–5 score
  relaxation: number; // 1–5 score
}

const POINTS_PER_HOUR = 20; // ~one reading every 3 minutes

export const timelineFor = (patientId: string): TimelinePoint[] => {
  const m = patientById(patientId)?.metrics ?? { fatigue: 50, attention: 50, relaxation: 50 };
  const seed = patientId.charCodeAt(1) || 1;
  return Array.from({ length: POINTS_PER_HOUR }).map((_, i) => {
    const minsAgo = Math.round(((POINTS_PER_HOUR - 1 - i) / (POINTS_PER_HOUR - 1)) * 60);
    const wob = Math.sin((i + seed) / 2);
    return {
      t: minutesAgo(minsAgo),
      fatigue: clampScore(scoreOf(m.fatigue, true) + wob * 0.6),
      attention: clampScore(scoreOf(m.attention) - wob * 0.5),
      relaxation: clampScore(scoreOf(m.relaxation) + wob * 0.4),
    };
  });
};

const clampScore = (n: number) => Math.max(1, Math.min(5, n));

/**
 * Mock relative band powers for a patient, derived from their displayed metrics
 * so the spectrum stays coherent with the tiles (fatigue → slow waves up,
 * attention → beta up, relaxation → alpha up). Backend will stream the real
 * values; this just keeps the demo self-consistent. Fractions sum to ~1.
 */
export const bandPowersFor = (patientId: string): BandPowers => {
  const m = patientById(patientId)?.metrics ?? { fatigue: 50, attention: 50, relaxation: 50 };
  const raw = {
    delta: 0.4 * m.fatigue + 10,
    theta: 0.6 * m.fatigue + 10,
    alpha: 0.7 * m.relaxation + 10,
    beta: 0.8 * m.attention + 10,
    gamma: 12,
  };
  const sum = raw.delta + raw.theta + raw.alpha + raw.beta + raw.gamma;
  return {
    delta: raw.delta / sum,
    theta: raw.theta / sum,
    alpha: raw.alpha / sum,
    beta: raw.beta / sum,
    gamma: raw.gamma / sum,
  };
};

// ---------------------------------------------------------------------------
// Vitals (wearable modalities — non-EEG). Heart rate is the first; SpO2 /
// temperature / respiration could follow the same shape. Simulated here in a
// natural range, derived from the patient's status so the demo stays coherent
// (a distressed patient also shows an elevated, more irregular heart rate).
// ---------------------------------------------------------------------------

export interface HeartRateReading {
  value: number; // current bpm
  trend: number[]; // recent readings (oldest → newest)
  status: StatusLevel; // normal / elevated coloring
  labelKey: string; // i18n key: hrStatus.normal | hrStatus.elevated | hrStatus.low
}

/** Resting baseline bpm by wellness status. */
const HR_BASE: Record<StatusLevel, number> = { good: 68, warn: 80, bad: 96 };

export const heartRateFor = (patientId: string): HeartRateReading => {
  const status = patientById(patientId)?.status ?? 'good';
  const base = HR_BASE[status];
  const amp = status === 'bad' ? 10 : status === 'warn' ? 6 : 3; // more variability when unwell
  const seed = patientId.charCodeAt(1) || 1;
  const trend = Array.from({ length: 12 }).map((_, i) =>
    Math.round(base + Math.sin((i + seed) / 1.5) * amp + ((i * seed) % 3) - 1),
  );
  const value = trend[trend.length - 1];
  const level: StatusLevel =
    value > 110 || value < 45 ? 'bad' : value > 100 || value < 55 ? 'warn' : 'good';
  const labelKey =
    value > 100 ? 'hrStatus.elevated' : value < 55 ? 'hrStatus.low' : 'hrStatus.normal';
  return { value, trend, status: level, labelKey };
};

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
    id: 'l0',
    patient_id: 'p1',
    segment_id: 'seg2',
    event_id: 'e0',
    activity: 'Morning walk',
    medications: ['Aspirin 81mg'],
    subjective_state: 'Felt steady and clear-headed',
    event_type: 'Routine check',
    resolution: 'No action needed',
    extraction_method: 'caregiver_manual',
    confidence: 1,
    confirmed_by_caregiver: true,
    confirmed_at: hoursAgo(20),
  },
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
  { id: 'm3', patient_id: 'p1', medication_name: 'Aspirin 81mg', taken_at: hoursAgo(13) },
  { id: 'm4', patient_id: 'p1', medication_name: 'Metformin 500mg', taken_at: hoursAgo(25) },
];

export const activityLogsForPatient = (patientId: string): ActivityLog[] =>
  ACTIVITY_LOGS.filter((l) => l.patient_id === patientId).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

export const medicationLogsForPatient = (patientId: string): MedicationLog[] =>
  MEDICATION_LOGS.filter((l) => l.patient_id === patientId).sort(
    (a, b) => +new Date(b.taken_at) - +new Date(a.taken_at),
  );

/** Distinct medication names this patient has logged before (for the dropdown). */
export const previousMedicationNames = (patientId: string): string[] =>
  Array.from(new Set(medicationLogsForPatient(patientId).map((l) => l.medication_name)));

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
