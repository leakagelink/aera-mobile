import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Mic } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { readAudioBase64, writeReplyAudio } from '@/services/ai/audioFile';
import { sendAiChat, speakText, transcribeSpeech, type AiChatTurn } from '@/services/ai/chat';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';

export function HomeVoice() {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [items, setItems] = useState<AiChatTurn[]>([]);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      player.current?.pause();
      player.current?.release();
      player.current = null;
    };
  }, []);

  async function ask(text: string) {
    const message = text.trim();
    if (!message) return;
    const history = items;
    setItems((current) => [...current, { role: 'user', text: message }]);
    setPending(true);
    setNote('Soch raha hoon...');
    try {
      const result = await sendAiChat(message, history);
      setItems((current) => [...current, { role: 'assistant', text: result.message }]);
      setReply(result.message);
      setNote(null);
      await play(result.message);
    } catch (caught) {
      setNote(errorMessage(caught, 'Assistant abhi available nahi hai.'));
    } finally {
      setPending(false);
    }
  }

  async function play(text: string) {
    try {
      player.current?.pause();
      player.current?.release();
      const uri = await writeReplyAudio(await speakText(text));
      const next = createAudioPlayer(uri);
      player.current = next;
      next.play();
    } catch (caught) {
      setNote(errorMessage(caught, 'Jawab likh kar aa gaya. Voice ke liye admin mein ElevenLabs key chahiye.'));
    }
  }

  async function toggleMic() {
    if (pending) return;
    if (recording) {
      setRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setNote('Recording khali thi.');
        return;
      }
      setPending(true);
      setNote('Sun liya, likh raha hoon...');
      try {
        const text = await transcribeSpeech(await readAudioBase64(uri), 'audio/mp4');
        setPending(false);
        await ask(text);
      } catch (caught) {
        setPending(false);
        setNote(errorMessage(caught, 'Voice abhi available nahi hai.'));
      }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNote('Microphone permission off hai.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setReply(null);
    setNote('Bolo... phir Stop dabao.');
    setRecording(true);
  }

  return (
    <View style={styles.wrap}>
      {reply || note ? (
        <View style={[styles.reply, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
          <AppText size={14} style={styles.copy}>
            {note ?? reply}
          </AppText>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Bolna band karo' : 'Arah se bolo'}
        disabled={pending && !recording}
        onPress={() => void toggleMic()}
        style={[styles.button, { backgroundColor: recording ? theme.colors.primary : theme.colors.nav, borderColor: theme.colors.glassBorder }]}
      >
        <Mic color={recording ? theme.colors.primaryForeground : theme.colors.foreground} size={18} />
        <AppText size={14} weight="semibold" color={recording ? theme.colors.primaryForeground : theme.colors.foreground}>
          {recording ? 'Stop' : 'Bolo'}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignItems: 'flex-start' },
  reply: { maxWidth: '100%', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  copy: { lineHeight: 20 },
  button: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
});
