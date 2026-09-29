export const CURRENT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

const RETIRED_GEMINI_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-3.6-flash',
]);

export function currentGeminiModel(configured: string | null | undefined): string {
  const model = configured?.trim();
  if (!model || RETIRED_GEMINI_MODELS.has(model)) return CURRENT_GEMINI_MODEL;
  return model;
}
