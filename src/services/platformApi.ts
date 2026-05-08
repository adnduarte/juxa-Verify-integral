/**
 * Cliente hacia API de plataforma (Vite proxy /api → servidor Express).
 */

const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env : undefined;

const base = () => {
  const u = viteEnv?.VITE_PLATFORM_API_URL;
  return u ? String(u).replace(/\/$/, '') : '';
};

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${base()}${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || r.statusText);
  }
  return r.json() as Promise<T>;
}

export function isPlatformApiConfigured(): boolean {
  return true;
}
