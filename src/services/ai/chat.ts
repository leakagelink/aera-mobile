import { aeraApiRequest } from '@/services/api/client';
import { navigationSnapshot } from '@/features/navigation/progress';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';

export type AiChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AiPlaceCard = {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceMeters?: number;
};

export type AiCard =
  | { type: 'places'; places: AiPlaceCard[] }
  | { type: 'route'; name: string; summary: string; distanceMeters: number; durationSeconds: number; latitude: number; longitude: number };

export type AiChatResult = {
  message: string;
  toolCalls: { name: string; status: string; activity: string }[];
  cards: AiCard[];
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
      remember: usePreferencesStore.getState().rememberChats,
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
  return { message: body.message, toolCalls, cards: readCards(body as { cards?: unknown }) };
}

export async function loadAiMemory(): Promise<AiChatTurn[]> {
  const payload = await aeraApiRequest('/api/v1/ai/memory', { method: 'GET' });
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { messages?: unknown }).messages)) return [];
  return (payload as { messages: unknown[] }).messages.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const role = (item as { role?: unknown }).role;
    const text = (item as { text?: unknown }).text;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) return [];
    return [{ role, text }];
  });
}

export async function clearAiMemory(): Promise<void> {
  await aeraApiRequest('/api/v1/ai/memory', { method: 'DELETE' });
}

export async function transcribeSpeech(audioBase64: string, mimeType: string): Promise<string> {
  const payload = await aeraApiRequest('/api/v1/ai/speech/transcribe', {
    method: 'POST',
    timeoutMs: 45_000,
    body: { audioBase64, mimeType },
  });
  const text = payload && typeof payload === 'object' ? (payload as { text?: unknown }).text : undefined;
  if (typeof text !== 'string' || !text.trim()) throw new Error('No words were recognized.');
  return text.trim();
}

export async function speakText(text: string): Promise<string> {
  const payload = await aeraApiRequest('/api/v1/ai/speech/speak', {
    method: 'POST',
    timeoutMs: 45_000,
    body: { text },
  });
  const audioBase64 = payload && typeof payload === 'object' ? (payload as { audioBase64?: unknown }).audioBase64 : undefined;
  if (typeof audioBase64 !== 'string' || !audioBase64) throw new Error('The voice reply is unavailable.');
  return audioBase64;
}

function readCards(body: { cards?: unknown }): AiCard[] {
  if (!Array.isArray(body.cards)) return [];
  return body.cards.flatMap((card): AiCard[] => {
    if (!card || typeof card !== 'object') return [];
    const kind = (card as { type?: unknown }).type;
    if (kind === 'places' && Array.isArray((card as { places?: unknown }).places)) {
      const places = (card as { places: unknown[] }).places.flatMap((place) => {
        if (!place || typeof place !== 'object') return [];
        const row = place as { name?: unknown; latitude?: unknown; longitude?: unknown; address?: unknown; distanceMeters?: unknown };
        if (typeof row.name !== 'string' || typeof row.latitude !== 'number' || typeof row.longitude !== 'number') return [];
        return [{ name: row.name, latitude: row.latitude, longitude: row.longitude, address: typeof row.address === 'string' ? row.address : null, ...(typeof row.distanceMeters === 'number' ? { distanceMeters: row.distanceMeters } : {}) }];
      });
      return places.length > 0 ? [{ type: 'places' as const, places }] : [];
    }
    if (kind === 'route') {
      const route = card as { name?: unknown; summary?: unknown; distanceMeters?: unknown; durationSeconds?: unknown; latitude?: unknown; longitude?: unknown };
      if (typeof route.distanceMeters !== 'number' || typeof route.durationSeconds !== 'number' || typeof route.latitude !== 'number' || typeof route.longitude !== 'number') return [];
      return [{ type: 'route' as const, name: typeof route.name === 'string' ? route.name : 'Route', summary: typeof route.summary === 'string' ? route.summary : 'Route', distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, latitude: route.latitude, longitude: route.longitude }];
    }
    return [];
  });
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
    savedPlaces?: { name: string; latitude: number; longitude: number; address: string | null; kind: 'home' | 'work' | 'favorite' }[];
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
  const savedPlaces = [
    preferences.home ? { ...preferences.home, kind: 'home' as const } : null,
    preferences.work ? { ...preferences.work, kind: 'work' as const } : null,
    ...preferences.favorites.slice(0, 6).map((place) => ({ ...place, kind: 'favorite' as const })),
  ].filter((place): place is NonNullable<typeof place> => place !== null);
  if (savedPlaces.length > 0) context.savedPlaces = savedPlaces;
  return context;
}
