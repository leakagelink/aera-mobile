import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { GlassCard } from '@/components/ui/GlassCard';
import { sendAiChat, type AiChatTurn } from '@/services/ai/chat';
import { font } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';

type TranscriptItem = AiChatTurn & { activities?: string[] };

export default function AiScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    const history = items.map((item) => ({ role: item.role, text: item.text }));
    setDraft('');
    setError(null);
    setPending(true);
    setItems((current) => [...current, { role: 'user', text: message }]);
    try {
      const result = await sendAiChat(message, history);
      setItems((current) => [...current, { role: 'assistant', text: result.message, activities: result.toolCalls.map((call) => call.activity) }]);
    } catch (caught) {
      setError(errorMessage(caught, 'The assistant is unavailable. Try again.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
        <AppText size={34} weight="semibold">
          Talk to your map
        </AppText>
        <AppText size={15} color={theme.colors.mutedForeground} style={styles.copy}>
          Ask about your location, route, speed, trips, weather, or traffic. Arah answers from the app and says when something is unavailable.
        </AppText>
        {items.map((item, index) => (
          <GlassCard key={`${item.role}-${index}`} padded style={styles.card}>
            <AppText size={12} color={theme.colors.mutedForeground}>
              {item.role === 'user' ? 'You' : 'Arah'}
            </AppText>
            {item.activities?.map((activity) => (
              <AppText key={activity} size={13} color={theme.colors.mutedForeground} style={styles.activity}>
                {activity}
              </AppText>
            ))}
            <AppText size={15} style={styles.message}>
              {item.text}
            </AppText>
          </GlassCard>
        ))}
        {pending ? (
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.status}>
            Thinking...
          </AppText>
        ) : null}
        {error ? (
          <GlassCard padded style={styles.card}>
            <AppText size={14}>{error}</AppText>
            <PrimaryButton style={styles.retry} onPress={() => void submit(items.filter((item) => item.role === 'user').at(-1)?.text ?? '')}>
              Try again
            </PrimaryButton>
          </GlassCard>
        ) : null}
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: insets.bottom + 88, borderTopColor: theme.colors.glassBorder }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Arah"
          placeholderTextColor={theme.colors.mutedForeground}
          editable={!pending}
          style={[styles.input, { color: theme.colors.foreground, backgroundColor: theme.colors.nav, borderColor: `${theme.colors.primary}66`, fontFamily: font.medium }]}
          accessibilityLabel="Message Arah"
        />
        <PrimaryButton disabled={pending || draft.trim().length === 0} onPress={() => void submit(draft)}>
          Send
        </PrimaryButton>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  copy: { marginTop: 12, lineHeight: 22 },
  card: { marginTop: 16 },
  activity: { marginTop: 8 },
  message: { marginTop: 8, lineHeight: 22 },
  status: { marginTop: 16 },
  retry: { marginTop: 12 },
  composer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
});
