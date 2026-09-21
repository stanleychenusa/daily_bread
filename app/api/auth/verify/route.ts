import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { createSession, ensureSchema, attachSession } from '@/lib/server';

export async function GET(request: Request) {
  await ensureSchema();
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/?confirmed=invalid', url));

  const user = await env.DB.prepare('SELECT id FROM users WHERE verify_token = ?').bind(token).first<{ id: string }>();
  if (!user) return NextResponse.redirect(new URL('/?confirmed=invalid', url));

  await env.DB.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?').bind(user.id).run();
  const sessionToken = await createSession(user.id);
  const response = NextResponse.redirect(new URL('/home?welcome=1', url));
  attachSession(response, sessionToken, request);
  return response;
}
