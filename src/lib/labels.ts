/**
 * Simplified single-category EEG labels (one ML class per point), replacing the
 * old multi-field label form. Stored in the existing `labels` table's `activity`
 * column so the continual-learning backend (which reads `activity`) keeps working.
 *
 * Canonical category values are English (stable ML class names); the UI shows a
 * translated label for predefined ones and the raw text for custom (free-text /
 * voice) ones.
 */
export type LabelSource = 'predefined' | 'freetext' | 'voice';

export const PREDEFINED_LABELS: { key: string; value: string }[] = [
  { key: 'seizure', value: 'Seizure' },
  { key: 'spike', value: 'Spike' },
  { key: 'artifact', value: 'Artifact' },
  { key: 'noise', value: 'Noise' },
  { key: 'movement', value: 'Movement' },
  { key: 'fall', value: 'Fall' },
  { key: 'normal', value: 'Normal' },
];

const VALUE_TO_KEY = new Map(PREDEFINED_LABELS.map((l) => [l.value.toLowerCase(), l.key]));

/** i18n key for a predefined category, or null if it's a custom label. */
export function categoryKey(value: string): string | null {
  return VALUE_TO_KEY.get(value.trim().toLowerCase()) ?? null;
}
