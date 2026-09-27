export async function fetchJson(url: string, headers: Record<string, string>, timeoutMs = 12_000): Promise<unknown> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}
