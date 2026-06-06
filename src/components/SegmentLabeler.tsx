/**
 * SegmentLabeler — clinician labeling, shown under the embedding map.
 *
 * One simple ML category per point (Seizure / Noise / Fall / …). Apply a label
 * to the tapped point (or the latest streamed point) by: tapping a predefined
 * chip, typing a custom label, or dictating one (OpenRouter voice → text,
 * English or Chinese). Writes to the `labels` table so the continual-learning
 * backend can train on it.
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
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { categoryKey, PREDEFINED_LABELS } from '@/lib/labels';
import { transcribeAudio } from '@/lib/transcribe';
import { EegSegment } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime } from '@/utils/time';

type Props = {
  displayName: string;
  segments: EegSegment[];
  selectedId: string | null;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onloadend = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });
}

export function SegmentLabeler({ displayName, segments, selectedId }: Props) {
  const { t } = useTranslation();
  const { labels, add } = useSegmentLabels(displayName);
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const target = useMemo(() => {
    if (selectedId) return segments.find((s) => s.id === selectedId);
    return segments.length ? segments[segments.length - 1] : undefined;
  }, [segments, selectedId]);
  const targetId = target?.id ?? null;

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
    if (!target) return;
    add(cat, targetId, 'predefined');
  };

  const addCustom = () => {
    const v = draft.trim();
    if (!v || !target) return;
    add(v, targetId, 'freetext');
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
        if (text && target) add(text, targetId, 'voice');
        else if (!text) setErr(t('labels.voiceEmpty'));
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

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>{t('labels.title')}</Text>

      {target ? (
        <Text style={styles.target}>
          {t(selectedId ? 'labels.targetSelected' : 'labels.targetLatest', {
            time: clockTime(target.timestamp_start),
          })}{' '}
          · {t('labels.anomaly', { score: Math.round((target.anomaly_score ?? 0) * 100) })}
        </Text>
      ) : (
        <Text style={styles.target}>{t('labels.noSegments')}</Text>
      )}
      <Text style={styles.hint}>{t('labels.tapHint')}</Text>

      {/* Predefined + previously-used custom labels */}
      <View style={styles.chips}>
        {PREDEFINED_LABELS.map((l) => (
          <Pressable
            key={l.key}
            style={[styles.chip, !target && styles.chipDisabled]}
            disabled={!target}
            onPress={() => apply(l.value)}
          >
            <Text style={styles.chipText}>{t(`labelCat.${l.key}`)}</Text>
          </Pressable>
        ))}
        {customCats.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, styles.chipCustom, !target && styles.chipDisabled]}
            disabled={!target}
            onPress={() => apply(c)}
          >
            <Text style={styles.chipText}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {/* Custom label: free text + voice */}
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
          disabled={!draft.trim() || !target}
          style={[styles.addBtn, (!draft.trim() || !target) && styles.chipDisabled]}
        >
          <Text style={styles.addBtnText}>{t('labels.addBtn')}</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={toggleVoice}
        disabled={!target || busy}
        style={[styles.voiceBtn, recording && styles.voiceBtnRec, (!target || busy) && styles.chipDisabled]}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={[styles.voiceText, recording && styles.voiceTextRec]}>
            {recording ? `■  ${t('labels.recording')}` : `🎤  ${t('labels.voice')}`}
          </Text>
        )}
      </Pressable>
      {busy ? <Text style={styles.hint}>{t('labels.transcribing')}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {/* Recent labels */}
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
  chipCustom: { backgroundColor: '#EFF4FF', borderColor: colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { ...typography.label, color: colors.text },
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
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voiceBtnRec: { borderColor: colors.statusBad, backgroundColor: '#FDECEC' },
  voiceText: { ...typography.bodyStrong, color: colors.primary },
  voiceTextRec: { color: colors.statusBad },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  labelCat: { ...typography.body, color: colors.text, flex: 1 },
  labelTime: { ...typography.caption, color: colors.textMuted },
});

export default SegmentLabeler;
