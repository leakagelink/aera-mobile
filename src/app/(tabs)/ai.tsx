import { useRouter } from 'expo-router';
import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { GlassCard } from '@/components/ui/GlassCard';
import { readAudioBase64, writeReplyAudio } from '@/services/ai/audioFile';
import { loadAiMemory, sendAiChat, speakText, transcribeSpeech, type AiCard, type AiChatTurn } from '@/services/ai/chat';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useSessionStore } from '@/store/sessionStore';
import { font } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance, formatDuration } from '@/utils/format';
import { errorMessage } from '@/utils/errors';

const prompts = ['Nearest hospital', 'Nearest petrol pump', 'Weather here', 'Mujhe kahin ghoomne jaana hai'];

type TranscriptItem = AiChatTurn & { activities?: string[]; cards?: AiCard[] };

export default function AiScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const units = usePreferencesStore((state) => state.units);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usePreferencesStore.getState().rememberChats) return;
    void loadAiMemory()
      .then((messages) => setItems(messages))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      player.current?.pause();
      player.current?.release();
      player.current = null;
    };
  }, []);

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
      setItems((current) => [...current, { role: 'assistant', text: result.message, activities: result.toolCalls.map((call) => call.activity), cards: result.cards }]);
    } catch (caught) {
      setError(errorMessage(caught, 'The assistant is unavailable. Try again.'));
    } finally {
      setPending(false);
    }
  }

  async function toggleMic() {
    if (pending) return;
    if (recording) {
      setRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setVoiceNote('The recording was empty.');
        return;
      }
      setPending(true);
      setVoiceNote('Transcribing...');
      try {
        const text = await transcribeSpeech(await readAudioBase64(uri), 'audio/mp4');
        setVoiceNote(null);
        setPending(false);
        await submit(text);
      } catch (caught) {
        setPending(false);
        setVoiceNote(errorMessage(caught, 'Voice is unavailable. You can still type.'));
      }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setVoiceNote('Microphone permission is off. You can still type.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setVoiceNote('Listening... tap Stop when you are done.');
    setRecording(true);
  }

  async function playReply(text: string) {
    setVoiceNote('Preparing voice...');
    try {
      player.current?.pause();
      player.current?.release();
      const uri = await writeReplyAudio(await speakText(text));
      const next = createAudioPlayer(uri);
      player.current = next;
      next.play();
      setVoiceNote(null);
    } catch (caught) {
      setVoiceNote(errorMessage(caught, 'Voice is not configured. Add the ElevenLabs key in the admin panel.'));
    }
  }

  function openCard(card: AiCard, placeName?: string, latitude?: number, longitude?: number, address?: string | null) {
    const name = placeName ?? (card.type === 'route' ? card.summary : 'Place');
    const lat = latitude ?? (card.type === 'route' ? card.latitude : 0);
    const lon = longitude ?? (card.type === 'route' ? card.longitude : 0);
    useSessionStore.getState().setDestination({ id: `${lat},${lon}`, name, address: address ?? name, latitude: lat, longitude: lon });
    router.push('/destination');
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
        <AppText size={34} weight="semibold">
          Talk to your map
        </AppText>
        <AppText size={15} color={theme.colors.mutedForeground} style={styles.copy}>
          Talk about the trip, a nearby place, or something ordinary. Arah answers in your language and only uses real map data.
        </AppText>
        <View style={styles.prompts}>
          {prompts.map((prompt) => (
            <Pressable
              key={prompt}
              accessibilityRole="button"
              disabled={pending}
              onPress={() => void submit(prompt)}
              style={[styles.prompt, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder, opacity: pending ? 0.5 : 1 }]}
            >
              <AppText size={13} weight="medium">
                {prompt}
              </AppText>
            </Pressable>
          ))}
        </View>
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
            {item.cards?.map((card, cardIndex) =>
              card.type === 'places' ? (
                card.places.map((place) => (
                  <Pressable key={`${place.name}-${cardIndex}`} accessibilityRole="button" onPress={() => openCard(card, place.name, place.latitude, place.longitude, place.address)} style={styles.cardAction}>
                    <AppText size={14} weight="semibold">
                      {place.name}
                    </AppText>
                    <AppText size={12} color={theme.colors.mutedForeground}>
                      {place.distanceMeters ? `${formatDistance(place.distanceMeters, units)} · ` : ''}
                      Open route
                    </AppText>
                  </Pressable>
                ))
              ) : (
                <Pressable key={`route-${cardIndex}`} accessibilityRole="button" onPress={() => openCard(card)} style={styles.cardAction}>
                  <AppText size={14} weight="semibold">
                    {card.summary}
                  </AppText>
                  <AppText size={12} color={theme.colors.mutedForeground}>
                    {formatDistance(card.distanceMeters, units)} · {formatDuration(card.durationSeconds)} · Open route
                  </AppText>
                </Pressable>
              ),
            )}
            {item.role === 'assistant' ? (
              <Pressable accessibilityRole="button" onPress={() => void playReply(item.text)} style={styles.cardAction}>
                <AppText size={13} weight="semibold" color={theme.colors.primary}>
                  Play reply
                </AppText>
              </Pressable>
            ) : null}
          </GlassCard>
        ))}
        {voiceNote ? (
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.status}>
            {voiceNote}
          </AppText>
        ) : null}
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
        <View style={styles.actions}>
          <PrimaryButton disabled={pending} onPress={() => void toggleMic()}>
            {recording ? 'Stop' : 'Talk'}
          </PrimaryButton>
          <PrimaryButton disabled={pending || recording || draft.trim().length === 0} onPress={() => void submit(draft)}>
            Send
          </PrimaryButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  copy: { marginTop: 12, lineHeight: 22 },
  prompts: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  card: { marginTop: 16 },
  activity: { marginTop: 8 },
  message: { marginTop: 8, lineHeight: 22 },
  cardAction: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  status: { marginTop: 16 },
  retry: { marginTop: 12 },
  composer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
});
