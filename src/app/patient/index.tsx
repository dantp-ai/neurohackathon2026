import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { AuraRing } from '@/components/AuraRing';
import { MicIcon } from '@/components/MicIcon';
import { Button, Card, MetricTile, Screen, TextField, VitalCard } from '@/components';
import { PatientBrainMap } from '@/components/PatientBrainMap';
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { categorizeText } from '@/lib/categorize';
import { transcribeAudio } from '@/lib/transcribe';
import { CURRENT_PATIENT, heartRateFor, scoresFor } from '@/mock/data';
import { useSession } from '@/store/session';
import { CheckinResponseValue } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const FEELINGS: { value: CheckinResponseValue; labelKey: string; label: string }[] = [
  { value: 'ok', labelKey: 'feelings.okay', label: 'Feeling okay' },
  { value: 'not_great', labelKey: 'feelings.notGreat', label: 'Not great' },
  { value: 'help', labelKey: 'feelings.needHelp', label: 'Needs help' },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onloadend = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });
}

/** Patient home: aura wellness ring, a voice-enabled check-in, readings, brain map. */
export default function PatientHome() {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const patient = CURRENT_PATIENT;
  const scores = scoresFor(patient.metrics);
  const hr = heartRateFor(patient.user.id);
  const wellness = (scores.fatigue + scores.attention + scores.relaxation) / 15;
  const { add: addLabel } = useSegmentLabels(patient.user.display_name);

  const [feeling, setFeeling] = useState<CheckinResponseValue | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const submit = async () => {
    const text = note.trim();
    setSent(true);
    setNote('');
    const chosen = feeling;
    setFeeling(null);
    // Turn the check-in into a patient-sourced label for the clinician to review.
    try {
      if (text) {
        const cat = await categorizeText(text);
        if (cat) addLabel(cat, null, 'freetext', 'patient');
      } else if (chosen) {
        const f = FEELINGS.find((x) => x.value === chosen);
        if (f) addLabel(f.label, null, 'predefined', 'patient');
      }
    } catch {
      /* best-effort */
    }
  };

  const toggleVoice = async () => {
    if (busy) return;
    if (recording) {
      setRecording(false);
      setBusy(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('no audio');
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const b64 = await blobToBase64(blob);
        const fmt = uri.split('.').pop()?.toLowerCase() || 'm4a';
        const text = await transcribeAudio(b64, fmt);
        if (text) setNote((n) => (n ? `${n} ${text}` : text));
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.greeting}>{t('patient.hello', { name: user?.display_name?.split(' ')[0] ?? 'there' })}</Text>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.switch}>{t('common.signOut')}</Text>
        </Pressable>
      </View>

      <View style={styles.ringWrap}>
        <AuraRing
          score={wellness}
          level={patient.status}
          label={t('patient.wellness')}
          sublabel={t('caregiver.updated', { time: timeAgo(patient.lastUpdated) })}
        />
      </View>

      <Card style={styles.checkinCard}>
        <Text style={styles.checkinTitle}>{t('patient.checkinTitle')}</Text>
        <Text style={styles.checkinPrompt}>{t('patient.checkinPrompt')}</Text>
        <View style={styles.feelingRow}>
          {FEELINGS.map((f) => {
            const active = feeling === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFeeling(f.value)}
                style={[styles.feelingBtn, active && styles.feelingBtnActive]}
              >
                <Text style={[styles.feelingLabel, active && styles.feelingLabelActive]}>{t(f.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label={t('patient.describe')}
          value={note}
          onChangeText={setNote}
          placeholder={t('patient.describePlaceholder')}
          multiline
          style={styles.noteInput}
        />
        <Pressable
          onPress={toggleVoice}
          disabled={busy}
          style={[styles.voiceBtn, recording && styles.voiceBtnRec, busy && styles.voiceBtnBusy]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.voiceInner}>
              <MicIcon size={18} color="#FFFFFF" />
              <Text style={styles.voiceText}>{recording ? t('patient.recording') : t('patient.speak')}</Text>
            </View>
          )}
        </Pressable>
        <Button title={t('patient.sendCare')} size="lg" disabled={!feeling && !note.trim()} onPress={submit} />
        {sent ? <Text style={styles.sentNote}>{t('patient.thanks')}</Text> : null}
      </Card>

      <Text style={styles.sectionTitle}>{t('patient.currentReadings')}</Text>
      <View style={styles.metrics}>
        <MetricTile label={t('metrics.energy')} score={scores.fatigue} accent={colors.fatigue} />
        <MetricTile label={t('metrics.attention')} score={scores.attention} accent={colors.attention} />
        <MetricTile label={t('metrics.relaxation')} score={scores.relaxation} accent={colors.relaxation} />
      </View>

      <Text style={[styles.sectionTitle, styles.vitalsTitle]}>{t('metrics.vitals')}</Text>
      <VitalCard
        icon="❤️"
        label={t('metrics.heartRate')}
        value={hr.value}
        unit={t('common.bpm')}
        status={hr.status}
        statusLabel={t(hr.labelKey)}
        trend={hr.trend}
      />

      <View style={styles.mapWrap}>
        <PatientBrainMap displayName={patient.user.display_name} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { ...typography.title, color: colors.text },
  switch: { ...typography.label, color: colors.primary },
  ringWrap: { alignItems: 'center', marginVertical: spacing.md },
  checkinCard: {
    gap: spacing.md,
    marginBottom: spacing.xl,
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#F2F8FF',
  },
  checkinTitle: { ...typography.heading, color: colors.primary },
  checkinPrompt: { ...typography.body, color: colors.text },
  feelingRow: { flexDirection: 'row', gap: spacing.sm },
  feelingBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  feelingBtnActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  feelingLabel: { ...typography.label, color: colors.textMuted, textAlign: 'center' },
  feelingLabelActive: { color: colors.primary },
  noteInput: { minHeight: 64, textAlignVertical: 'top' },
  voiceBtn: {
    backgroundColor: colors.statusBad,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voiceBtnRec: { backgroundColor: '#B23636' },
  voiceBtnBusy: { opacity: 0.6 },
  voiceInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voiceText: { ...typography.bodyStrong, color: '#FFFFFF' },
  sentNote: { ...typography.caption, color: colors.statusGood },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.md },
  vitalsTitle: { marginTop: spacing.xl },
  metrics: { flexDirection: 'row', gap: spacing.md },
  mapWrap: { marginTop: spacing.xl },
});
