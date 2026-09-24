import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Operational check for the web deployment: which API base the server uses and whether it answers.
 * Exposes no secrets (the API base is public in the browser bundle anyway).
 */
export async function GET() {
  const raw = { API_URL: process.env.API_URL ?? null, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? null };
  const base = ((process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim())
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
  const target = `${base}/api/health`;

  const started = Date.now();
  let api: { ok: boolean; status?: number; body?: string; error?: string };
  try {
    const res = await fetch(target, { cache: 'no-store' });
    api = { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 200) };
  } catch (err) {
    api = { ok: false, error: (err as Error).message };
  }

  return NextResponse.json({
    web: 'ok',
    env: raw,
    apiBase: base,
    probe: { url: target, ms: Date.now() - started, ...api },
  });
}
