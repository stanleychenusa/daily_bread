import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureSchema, hashPassword, jsonError, randomToken, sendVerificationEmail } from '@/lib/server';

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json<{ firstName?: string; lastName?: string; email?: string; password?: string }>();
  const firstName = body.firstName?.trim() ?? '';
  const lastName = body.lastName?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (!firstName || !lastName) return jsonError('Please enter your first and last name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return jsonError('Please enter a valid email address.');
  if (password.length < 8) return jsonError('Your password must be at least 8 characters.');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return jsonError('An account with that email already exists.', 409);

  const id = crypto.randomUUID();
  const verifyToken = randomToken(24);
  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (id, first_name, last_name, email, password_hash, password_salt, verified, verify_token, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
  ).bind(id, firstName, lastName, email, hash, salt, verifyToken, Date.now()).run();

  const verificationUrl = `${new URL(request.url).origin}/api/auth/verify?token=${verifyToken}`;
  const emailSent = await sendVerificationEmail({ email, firstName, verificationUrl });
  return NextResponse.json({ ok: true, emailSent, previewVerificationUrl: emailSent ? null : verificationUrl }, { status: 201 });
}
