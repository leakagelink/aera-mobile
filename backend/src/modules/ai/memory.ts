export type StoredTurn = { role: 'user' | 'assistant'; text: string };

const MAX_TURNS = 20;

export function aiMemoryKey(userId: string): string {
  return `aera:ai:memory:${userId}`;
}

export function appendMemory(current: StoredTurn[], turns: StoredTurn[]): StoredTurn[] {
  const next = [...current];
  for (const turn of turns) {
    const text = turn.text.trim().slice(0, 500);
    if (!text || (turn.role !== 'user' && turn.role !== 'assistant')) continue;
    next.push({ role: turn.role, text });
  }
  return next.slice(-MAX_TURNS);
}

export function parseMemory(raw: string | null): StoredTurn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return appendMemory([], parsed as StoredTurn[]);
  } catch {
    return [];
  }
}
