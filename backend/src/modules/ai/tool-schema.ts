export type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'number' | 'string' | 'boolean'; minimum?: number; maximum?: number; maxLength?: number }>;
  required?: string[];
};

export function validateToolArgs(schema: JsonSchema, value: unknown): { ok: true; args: Record<string, unknown> } | { ok: false } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const input = value as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));
  if (Object.keys(input).some((key) => !allowed.has(key))) return { ok: false };
  for (const key of schema.required ?? []) {
    if (input[key] === undefined || input[key] === null) return { ok: false };
  }
  const args: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (input[key] === undefined) continue;
    const parsed = parseValue(input[key], rule);
    if (parsed === undefined) return { ok: false };
    args[key] = parsed;
  }
  return { ok: true, args };
}

function parseValue(value: unknown, rule: JsonSchema['properties'][string]): unknown {
  if (rule.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    if (rule.minimum !== undefined && value < rule.minimum) return undefined;
    if (rule.maximum !== undefined && value > rule.maximum) return undefined;
    return value;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || (rule.maxLength !== undefined && trimmed.length > rule.maxLength)) return undefined;
    return trimmed;
  }
  if (typeof value !== 'boolean') return undefined;
  return value;
}
