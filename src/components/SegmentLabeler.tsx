/**
 * SegmentLabeler — clinician labeling, shown under the embedding map.
 *
 * One simple ML category per point (Seizure / Noise / Fall / …). Apply a label
 * to the tapped point (or the latest streamed point) by tapping a chip (the
 * tapped chip highlights), typing a custom label, or dictating one (red mic →
 * OpenRouter voice → text, English or Chinese). Writes to the `labels` table.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { Card } from './Card';
import { MicIcon } from './MicIcon';
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { categoryKey, PREDEFINED_LABELS } from '@/lib/labels';
import { transcribeAudio } from '@/lib/transcribe';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime } from '@/utils/time';

type Props = {
  displayName: string;
  /** The point being labeled (timestamp + anomaly), or null if none selected. */
  targetTime: string | null;
  targetAnomaly: number | null;
  /** Apply a label to the current target (the parent persists/streams as needed). */
  onLabel: (category: string) => void | Promise<void>;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onloadend = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });
}

export function SegmentLabeler({ displayName, targetTime, targetAnomaly, onLabel }: Props) {
  const { t } = useTranslation();
  const { labels } = useSegmentLabels(displayName);
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const canLabel = targetTime !== null;

  const customCats = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of labels) {
      if (categoryKey(l.category)) continue;
      const k = l.category.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(l.category);
      }
    }
    return out.slice(0, 8);
  }, [labels]);

  const apply = (cat: string) => {
    if (!canLabel) return;
    setPicked(cat);
    onLabel(cat);
  };

  const addCustom = () => {
    const v = draft.trim();
    if (!v || !canLabel) return;
    apply(v);
    setDraft('');
  };

  const toggleVoice = async () => {
    if (busy) return;
    if (recording) {
      setRecording(false);
      setBusy(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('No recording');
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const b64 = await blobToBase64(blob);
        const fmt = uri.split('.').pop()?.toLowerCase() || 'm4a';
        const text = await transcribeAudio(b64, fmt);
        if (text) apply(text);
        else setErr(t('labels.voiceEmpty'));
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      setErr(null);
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr(t('labels.micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const display = (cat: string) => {
    const k = categoryKey(cat);
    return k ? t(`labelCat.${k}`) : cat;
  };

  const Chip = ({ value, label }: { value: string; label: string }) => {
    const on = picked === value;
    return (
      <Pressable
        style={[styles.chip, on && styles.chipOn, !canLabel && styles.chipDisabled]}
        disabled={!canLabel}
        onPress={() => apply(value)}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>{t('labels.title')}</Text>

      {targetTime ? (
        <Text style={styles.target}>
          {t('labels.targetSelected', { time: clockTime(targetTime) })} ·{' '}
          <Text style={(targetAnomaly ?? 0) > 0.3 ? styles.anomHigh : undefined}>
            {t('labels.anomaly', { score: Math.round((targetAnomaly ?? 0) * 100) })}
          </Text>
        </Text>
      ) : (
        <Text style={styles.target}>{t('labels.noSegments')}</Text>
      )}
      <Text style={styles.hint}>{t('labels.tapHint')}</Text>

      <View style={styles.chips}>
        {PREDEFINED_LABELS.map((l) => (
          <Chip key={l.key} value={l.value} label={t(`labelCat.${l.key}`)} />
        ))}
        {customCats.map((c) => (
          <Chip key={c} value={c} label={c} />
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder={t('labels.addPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Pressable
          onPress={addCustom}
          disabled={!draft.trim() || !canLabel}
          style={[styles.addBtn, (!draft.trim() || !canLabel) && styles.chipDisabled]}
        >
          <Text style={styles.addBtnText}>{t('labels.addBtn')}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={toggleVoice}
        disabled={!canLabel || busy}
        style={[styles.voiceBtn, recording && styles.voiceBtnRec, (!canLabel || busy) && styles.chipDisabled]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.voiceInner}>
            <MicIcon size={18} color="#FFFFFF" />
            <Text style={styles.voiceText}>{recording ? t('labels.recording') : t('labels.voice')}</Text>
          </View>
        )}
      </Pressable>
      {busy ? <Text style={styles.hint}>{t('labels.transcribing')}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Text style={styles.subhead}>{t('labels.recent')}</Text>
      {labels.length === 0 ? (
        <Text style={styles.hint}>{t('labels.none')}</Text>
      ) : (
        labels.slice(0, 8).map((l) => (
          <View key={l.id} style={styles.labelRow}>
            <View style={styles.labelDot} />
            <Text style={styles.labelCat}>{display(l.category)}</Text>
            <Text style={styles.labelTime}>{clockTime(l.created_at)}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  subhead: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm },
  target: { ...typography.bodyStrong, color: colors.text },
  anomHigh: { color: colors.statusBad },
  hint: { ...typography.caption, color: colors.textMuted },
  err: { ...typography.caption, color: colors.statusBad },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { ...typography.label, color: colors.text },
  chipTextOn: { color: colors.textInverse },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addBtnText: { ...typography.bodyStrong, color: colors.textInverse },
  voiceBtn: {
    backgroundColor: colors.statusBad,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voiceBtnRec: { backgroundColor: '#B23636' },
  voiceInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voiceText: { ...typography.bodyStrong, color: '#FFFFFF' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  labelCat: { ...typography.body, color: colors.text, flex: 1 },
  labelTime: { ...typography.caption, color: colors.textMuted },
});

export default SegmentLabeler;
