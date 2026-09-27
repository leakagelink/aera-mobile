const SECRET_QUERY = /([?&#](?:appid|key|api_key|apikey|token|access_token|secret)=)[^&\s#]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function sanitizeProviderError(value: string): string {
  return value.replace(SECRET_QUERY, '$1redacted').replace(BEARER, 'Bearer redacted').slice(0, 180);
}

export function stripSecretFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const blocked = new Set(['apikey', 'api_key', 'key', 'appid', 'token', 'secret', 'password', 'authorization']);
  const clean: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (blocked.has(key.toLowerCase())) continue;
    clean[key] = entry;
  }
  return clean;
}
