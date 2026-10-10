export type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'number' | 'string' | 'boolean'; minimum?: number; maximum?: number; maxLength?: number; enum?: string[] }>;
  required?: string[];
};

export function validateToolArgs(schema: JsonSchema, value: unknown): { ok: true; args: Record<string, unknown> } | { ok: false } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const input = value as Record<string, unknown>;
  const args: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (input[key] === undefined || input[key] === null) continue;
    const parsed = parseValue(input[key], rule);
    if (parsed === undefined) return { ok: false };
    args[key] = parsed;
  }
  for (const key of schema.required ?? []) {
    if (args[key] === undefined || args[key] === null) return { ok: false };
  }
  return { ok: true, args };
}

function parseValue(value: unknown, rule: JsonSchema['properties'][string]): unknown {
  if (rule.type === 'number') {
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
    if (!Number.isFinite(number)) return undefined;
    if (rule.minimum !== undefined && number < rule.minimum) return undefined;
    if (rule.maximum !== undefined && number > rule.maximum) return undefined;
    return number;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || (rule.maxLength !== undefined && trimmed.length > rule.maxLength)) return undefined;
    if (rule.enum && !rule.enum.includes(trimmed)) return undefined;
    return trimmed;
  }
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
