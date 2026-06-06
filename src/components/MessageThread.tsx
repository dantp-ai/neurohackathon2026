import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useMessages } from '@/hooks/useMessages';
import { Role } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime } from '@/utils/time';

type MessageThreadProps = {
  patientName: string;
  caregiverName: string;
  /** Who is composing — determines bubble alignment and sender_id on send. */
  senderRole: Role;
};

/**
 * Shared patient <-> caregiver conversation, backed by Supabase + Realtime so
 * the two sides sync live. Used by both the patient Messages tab and the
 * caregiver detail Messages tab.
 */
export function MessageThread({ patientName, caregiverName, senderRole }: MessageThreadProps) {
  const { messages, loading, error, senderId, send } = useMessages(
    patientName,
    caregiverName,
    senderRole,
  );
  const [draft, setDraft] = useState('');

  const onSend = () => {
    const content = draft.trim();
    if (!content) return;
    send(content);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? <Text style={styles.status}>Connecting…</Text> : null}
        {error ? <Text style={styles.status}>Can’t reach the server: {error}</Text> : null}
        {messages.map((m) => {
          const mine = m.sender_id === senderId;
          return (
            <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.text, mine && styles.textMine]}>{m.content}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {clockTime(m.created_at)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim()}
          style={[styles.sendBtn, !draft.trim() && styles.sendDisabled]}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { padding: spacing.lg, gap: spacing.sm },
  status: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  text: { ...typography.body, color: colors.text },
  textMine: { color: colors.textInverse },
  time: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.8)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendDisabled: { opacity: 0.45 },
  sendLabel: { ...typography.bodyStrong, color: colors.textInverse },
});

export default MessageThread;
