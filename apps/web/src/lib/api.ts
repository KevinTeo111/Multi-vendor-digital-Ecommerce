/** Accepts "https://host", "https://host/", or "https://host/api" and always yields "https://host". */
function normalizeBase(url: string | undefined, fallback: string) {
  const value = (url ?? '').trim() || fallback;
  return value.replace(/\/+$/, '').replace(/\/api$/, '');
}

const API_URL = normalizeBase(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Token storage (browser only)
// ---------------------------------------------------------------------------

const ACCESS_KEY = 'mp.accessToken';
const REFRESH_KEY = 'mp.refreshToken';

export function getTokens() {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  try {
    return {
      accessToken: window.localStorage.getItem(ACCESS_KEY),
      refreshToken: window.localStorage.getItem(REFRESH_KEY),
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  try {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    /* storage unavailable */
  }
}

export function clearTokens() {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------------------
// Client-side fetch with automatic refresh
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { refreshToken } = getTokens();
    if (!refreshToken) return false;
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    setTokens(await res.json());
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function buildQuery(query?: RequestOptions['query']) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = options;

  const doFetch = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const { accessToken } = getTokens();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(`${API_URL}/api${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();
  if (res.status === 401 && auth && (await tryRefresh())) {
    res = await doFetch();
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = extractMessage(data) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const m = (data as { message?: unknown }).message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return null;
}

// ---------------------------------------------------------------------------
// Server-side fetch (public endpoints only; no cookies/tokens involved)
// ---------------------------------------------------------------------------

export async function serverApi<T>(path: string, query?: RequestOptions['query']): Promise<T | null> {
  const base = normalizeBase(process.env.API_URL, API_URL);
  const url = `${base}/api${path}${buildQuery(query)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[serverApi] ${res.status} from ${url}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Next.js uses this error to mark the route as dynamic at build time; it must propagate.
    if (err instanceof Error && err.message.includes('Dynamic server usage')) throw err;
    console.error(`[serverApi] request failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

/** Uploads a file straight to object storage using a presigned URL. */
export async function uploadToPresignedUrl(uploadUrl: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}
