import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { countVerses } from '@/lib/reading';
import { getSessionUser, jsonError } from '@/lib/server';

type ReadingRow = { id: string; readingDate: string; passage: string; verseCount: number };

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 371);
  const startDate = start.toISOString().slice(0, 10);
  const result = await env.DB.prepare(
    `SELECT id, reading_date AS readingDate, passage, verse_count AS verseCount
     FROM readings WHERE user_id = ? AND reading_date >= ? ORDER BY reading_date DESC, created_at DESC`,
  ).bind(user.id, startDate).all<ReadingRow>();

  return NextResponse.json({ readings: result.results });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  const body = await request.json<{ date?: string; passage?: string }>();
  const readingDate = body.date?.trim() ?? '';
  const passage = body.passage?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) return jsonError('Please choose a valid date.');
  if (!passage) return jsonError('Please enter what you read.');

  const verseCount = countVerses(passage);
  if (verseCount < 1) return jsonError('Include verse numbers, such as John 3:16-18.');

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(`${readingDate}T12:00:00`).getTime() > today.getTime()) return jsonError('Reading dates can’t be in the future.');

  const reading: ReadingRow = { id: crypto.randomUUID(), readingDate, passage, verseCount };
  await env.DB.prepare(
    'INSERT INTO readings (id, user_id, reading_date, passage, verse_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(reading.id, user.id, readingDate, passage, verseCount, Date.now()).run();
  return NextResponse.json({ reading }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  await env.DB.prepare('DELETE FROM readings WHERE user_id = ?').bind(user.id).run();
  return NextResponse.json({ ok: true });
}
