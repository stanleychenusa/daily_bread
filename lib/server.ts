import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'daily_bread_session';
const SESSION_LENGTH = 60 * 60 * 24 * 30;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_date TEXT NOT NULL,
    passage TEXT NOT NULL,
    verse_count INTEGER NOT NULL,
    reflection TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, user_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_readings_user_date ON readings(user_id, reading_date)',
  'CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)',
];

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await env.DB.batch(schemaStatements.map((sql) => env.DB.prepare(sql)));
  await env.DB.prepare('PRAGMA optimize').run();
  schemaReady = true;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function randomToken(size = 24) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
}

async function digest(value: string) {
  const encoded = new TextEncoder().encode(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)));
}

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  // Cloudflare Workers currently supports PBKDF2 iteration counts up to 100,000.
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256);
  return { hash: bytesToHex(new Uint8Array(derived)), salt: bytesToHex(salt) };
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const id = await digest(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LENGTH;
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, expiresAt)
    .run();
  return token;
}

export function attachSession(response: NextResponse, token: string, request: Request) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    maxAge: SESSION_LENGTH,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const item of cookieHeader.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export type SessionUser = { id: string; firstName: string; lastName: string; email: string };

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  await ensureSchema();
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const id = await digest(token);
  const now = Math.floor(Date.now() / 1000);
  const user = await env.DB.prepare(
    `SELECT users.id, users.first_name AS firstName, users.last_name AS lastName, users.email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ? AND users.verified = 1`,
  ).bind(id, now).first<SessionUser>();
  return user ?? null;
}

export async function destroySession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await digest(token)).run();
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function sendVerificationEmail(options: { email: string; firstName: string; verificationUrl: string }) {
  if (!env.RESEND_API_KEY) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'Daily Bread <onboarding@resend.dev>',
      to: [options.email],
      subject: 'Confirm your Daily Bread account',
      html: `<div style="font-family:Arial,sans-serif;color:#473528;max-width:560px;margin:auto"><h1 style="font-family:Arial,sans-serif">Welcome to Daily Bread, ${escapeHtml(options.firstName)}!</h1><p>Confirm your email to begin tracking your Scripture reading.</p><p><a href="${options.verificationUrl}" style="display:inline-block;background:#a86235;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Confirm my email</a></p><p style="color:#7f6b5b;font-size:13px">This link expires in 24 hours.</p></div>`,
    }),
  });
  return response.ok;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
