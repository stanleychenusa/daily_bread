import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { attachSession, createSession, ensureSchema, hashPassword, jsonError } from '@/lib/server';

type LoginRow = { id: string; passwordHash: string; passwordSalt: string; verified: number };

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  const user = await env.DB.prepare(
    'SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt, verified FROM users WHERE email = ?',
  ).bind(email).first<LoginRow>();

  if (!user) return jsonError('That email or password does not match.', 401);
  const candidate = await hashPassword(password, user.passwordSalt);
  if (candidate.hash !== user.passwordHash) return jsonError('That email or password does not match.', 401);
  if (!user.verified) return jsonError('Please confirm your email before signing in.', 403);

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  attachSession(response, token, request);
  return response;
}
