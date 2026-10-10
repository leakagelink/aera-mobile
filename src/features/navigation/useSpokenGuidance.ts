import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { spokenCue, type SpokenInput } from '@/features/navigation/spoken';
import { writeReplyAudio } from '@/services/ai/audioFile';
import { speakText } from '@/services/ai/chat';

export function useSpokenGuidance(enabled: boolean, input: SpokenInput | null) {
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lastId = useRef<string | null>(null);
  const generation = useRef(0);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    return () => {
      generation.current += 1;
      player.current?.pause();
      player.current?.release();
      player.current = null;
    };
  }, []);

  const cueId = enabled && !muted && input ? spokenCue(input)?.id ?? null : null;

  useEffect(() => {
    if (!enabled || muted || !cueId) return;
    const current = inputRef.current;
    if (!current) return;
    const cue = spokenCue(current);
    if (!cue || cue.id === lastId.current) return;
    lastId.current = cue.id;
    const token = generation.current + 1;
    generation.current = token;
    void play(cue.phrase, token);
  }, [cueId, enabled, muted]);

  async function play(phrase: string, token: number) {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const audio = await speakText(phrase);
      if (token !== generation.current) return;
      const uri = await writeReplyAudio(audio, `arah-guidance-${token}.mp3`);
      if (token !== generation.current) return;
      player.current?.pause();
      player.current?.release();
      const next = createAudioPlayer(uri);
      player.current = next;
      next.play();
      setNote(null);
    } catch {
      if (token === generation.current) setNote('Awaaz nahi chali. Turn screen par dikh raha hai.');
    }
  }

  function toggleMuted() {
    setMuted((value) => {
      if (!value) {
        generation.current += 1;
        player.current?.pause();
        player.current?.release();
        player.current = null;
      }
      return !value;
    });
  }

  return { muted, note, toggleMuted };
}
