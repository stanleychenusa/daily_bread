import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { countBibleRange, formatBibleRange, isBibleRangeInput, validateBibleRange } from '@/lib/bible';
import { getSessionUser, jsonError } from '@/lib/server';

type ReadingRow = { id: string; readingDate: string; passage: string; verseCount: number; reflection: string };

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const result = await env.DB.prepare(
    `SELECT id, reading_date AS readingDate, passage, verse_count AS verseCount,
            COALESCE(reflection, '') AS reflection
     FROM readings WHERE user_id = ? ORDER BY reading_date DESC, created_at DESC`,
  ).bind(user.id).all<ReadingRow>();

  return NextResponse.json({ readings: result.results });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  const body = await request.json<{ date?: string; ranges?: unknown; reflection?: unknown }>();
  const readingDate = body.date?.trim() ?? '';
  if (body.reflection !== undefined && typeof body.reflection !== 'string') return jsonError('Please enter a valid reflection.');
  const reflection = typeof body.reflection === 'string' ? body.reflection.trim() : '';
  if (reflection.length > 5_000) return jsonError('Reflections can be up to 5,000 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) return jsonError('Please choose a valid date.');
  if (!Array.isArray(body.ranges) || body.ranges.length < 1) return jsonError('Add at least one Scripture passage.');
  if (body.ranges.length > 20) return jsonError('You can add up to 20 passages at a time.');

  const ranges = [];
  for (const candidate of body.ranges) {
    if (!isBibleRangeInput(candidate)) return jsonError('Choose a complete Bible passage.');
    const error = validateBibleRange(candidate);
    if (error) return jsonError(error);
    ranges.push(candidate);
  }

  const verseCount = ranges.reduce((total, range) => total + countBibleRange(range), 0);
  const passage = ranges.map(formatBibleRange).join('; ');

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(`${readingDate}T12:00:00`).getTime() > today.getTime()) return jsonError('Reading dates can’t be in the future.');

  const reading: ReadingRow = { id: crypto.randomUUID(), readingDate, passage, verseCount, reflection };
  await env.DB.prepare(
    'INSERT INTO readings (id, user_id, reading_date, passage, verse_count, reflection, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(reading.id, user.id, readingDate, passage, verseCount, reflection || null, Date.now()).run();
  return NextResponse.json({ reading }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const readingDate = new URL(request.url).searchParams.get('date');
  if (readingDate !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) return jsonError('Please choose a valid date.');
    await env.DB.prepare('DELETE FROM readings WHERE user_id = ? AND reading_date = ?').bind(user.id, readingDate).run();
    return NextResponse.json({ ok: true, readingDate });
  }

  await env.DB.prepare('DELETE FROM readings WHERE user_id = ?').bind(user.id).run();
  return NextResponse.json({ ok: true });
}
