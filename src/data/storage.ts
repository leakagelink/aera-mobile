import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ZodType } from 'zod';

export async function readStored<T>(key: string, schema: ZodType<T>, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export async function writeStored(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeStored(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
