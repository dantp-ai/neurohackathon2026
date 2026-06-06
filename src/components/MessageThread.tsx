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

import { messagesForThread } from '@/mock/data';
import { Message } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime } from '@/utils/time';

type MessageThreadProps = {
  patientId: string;
  caregiverId: string;
  /** Who is composing — determines bubble alignment and sender_id on send. */
  currentUserId: string;
};

/**
 * Shared WhatsApp-style conversation, used by both the patient Messages tab and
 * the caregiver detail Messages tab (mirrored). Local-only sending for now.
 */
export function MessageThread({ patientId, caregiverId, currentUserId }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    messagesForThread(patientId, caregiverId),
  );
  const [draft, setDraft] = useState('');

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    // TODO(backend): insert into messages.
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        patient_id: patientId,
        caregiver_id: caregiverId,
        sender_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
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
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
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
          onPress={send}
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
