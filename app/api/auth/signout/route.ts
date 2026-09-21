import { NextResponse } from 'next/server';

import { clearSessionCookie, destroySession, ensureSchema } from '@/lib/server';

export async function POST(request: Request) {
  await ensureSchema();
  await destroySession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
