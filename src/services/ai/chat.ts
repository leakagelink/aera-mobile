import { aeraApiRequest } from '@/services/api/client';
import { navigationSnapshot } from '@/features/navigation/progress';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';

export type AiChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AiChatResult = {
  message: string;
  toolCalls: { name: string; status: string; activity: string }[];
};

export async function sendAiChat(message: string, history: AiChatTurn[]): Promise<AiChatResult> {
  const payload = await aeraApiRequest('/api/v1/ai/chat', {
    method: 'POST',
    timeoutMs: 45_000,
    body: {
      message,
      history: history.slice(-8).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) })),
      context: currentAiContext(),
      ...(replyLanguage() ? { language: replyLanguage() } : {}),
    },
  });
  if (!payload || typeof payload !== 'object') {
    throw new Error('The assistant returned an unexpected response.');
  }
  const body = payload as { message?: unknown; toolCalls?: unknown };
  const toolCalls = Array.isArray(body.toolCalls)
    ? body.toolCalls.flatMap((call) => {
        if (!call || typeof call !== 'object') return [];
        const activity = (call as { activity?: unknown }).activity;
        const name = (call as { name?: unknown }).name;
        const status = (call as { status?: unknown }).status;
        if (typeof activity !== 'string' || typeof name !== 'string' || typeof status !== 'string') return [];
        return [{ name, status, activity }];
      })
    : [];
  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw new Error('The assistant returned an empty response.');
  }
  return { message: body.message, toolCalls };
}

function replyLanguage() {
  const language = usePreferencesStore.getState().assistantLanguage;
  return language === 'auto' ? undefined : language;
}

function currentAiContext() {
  const location = useLocationStore.getState().current;
  const destination = useSessionStore.getState().destination;
  const route = selectedRoute(useSessionStore.getState());
  const context: {
    location?: { latitude: number; longitude: number; accuracy: number | null; heading: number | null; speed: number | null; timestamp: string };
    navigation?: { remainingMeters: number; remainingSeconds: number; eta: number };
    destination?: { latitude: number; longitude: number; name: string };
    savedPlaces?: { name: string; latitude: number; longitude: number; address: string | null; kind: 'home' | 'work' }[];
  } = {};
  if (location) {
    context.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      heading: location.heading !== null && location.heading >= 0 && location.heading <= 360 ? location.heading : null,
      speed: location.speed !== null && location.speed >= 0 ? location.speed : null,
      timestamp: new Date(location.timestamp).toISOString(),
    };
    if (route) {
      const progress = navigationSnapshot(location, location.speed, route);
      context.navigation = {
        remainingMeters: progress.remainingMeters,
        remainingSeconds: progress.remainingSeconds,
        eta: progress.eta,
      };
    }
  }
  if (destination) {
    context.destination = { latitude: destination.latitude, longitude: destination.longitude, name: destination.name };
  }
  const preferences = usePreferencesStore.getState();
  const savedPlaces = [preferences.home ? { ...preferences.home, kind: 'home' as const } : null, preferences.work ? { ...preferences.work, kind: 'work' as const } : null].filter(
    (place): place is NonNullable<typeof place> => place !== null,
  );
  if (savedPlaces.length > 0) context.savedPlaces = savedPlaces;
  return context;
}
