import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getSessionUser, jsonError } from '@/lib/server';

type TeamRow = { id: string; name: string };
type TeamDetailRow = TeamRow & { description: string };
type MemberRow = { teamId: string; id: string; firstName: string; lastName: string };
type TeamDetailMemberRow = MemberRow & { joinedAt: number; totalVerseCount: number };
type TeamJourneyRow = { userId: string; readingDate: string; verseCount: number };
type TeamActivityRow = { id: string; userId: string; readingDate: string; passage: string; verseCount: number };

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  const teamId = new URL(request.url).searchParams.get('teamId');

  if (teamId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId)) {
      return jsonError('Please choose a valid team.');
    }

    const team = await env.DB.prepare(
      `SELECT teams.id, teams.name, COALESCE(teams.description, '') AS description FROM teams
       JOIN team_members ON team_members.team_id = teams.id
       WHERE teams.id = ? AND team_members.user_id = ?`,
    ).bind(teamId, user.id).first<TeamDetailRow>();
    if (!team) return jsonError('We couldn’t find that team, or you no longer have access to it.', 404);

    const [membersResult, journeyResult, activityResult] = await Promise.all([
      env.DB.prepare(
        `SELECT team_members.team_id AS teamId, users.id, users.first_name AS firstName,
                users.last_name AS lastName, team_members.joined_at AS joinedAt,
                COALESCE(SUM(readings.verse_count), 0) AS totalVerseCount
         FROM team_members
         JOIN users ON users.id = team_members.user_id
         LEFT JOIN readings ON readings.user_id = users.id
         WHERE team_members.team_id = ?
         GROUP BY team_members.team_id, users.id, users.first_name, users.last_name, team_members.joined_at
         ORDER BY team_members.joined_at ASC`,
      ).bind(teamId).all<TeamDetailMemberRow>(),
      env.DB.prepare(
        `SELECT readings.user_id AS userId, readings.reading_date AS readingDate,
                SUM(readings.verse_count) AS verseCount
         FROM readings JOIN team_members ON team_members.user_id = readings.user_id
         WHERE team_members.team_id = ? AND readings.reading_date >= ?
         GROUP BY readings.user_id, readings.reading_date
         ORDER BY readings.reading_date ASC`,
      ).bind(teamId, dateDaysAgo(370)).all<TeamJourneyRow>(),
      env.DB.prepare(
        `SELECT id, userId, readingDate, passage, verseCount FROM (
           SELECT readings.id, readings.user_id AS userId, readings.reading_date AS readingDate,
                  readings.passage, readings.verse_count AS verseCount,
                  readings.created_at AS createdAt,
                  ROW_NUMBER() OVER (
                    PARTITION BY readings.user_id
                    ORDER BY readings.reading_date DESC, readings.created_at DESC
                  ) AS readingRank
           FROM readings JOIN team_members ON team_members.user_id = readings.user_id
           WHERE team_members.team_id = ?
         ) WHERE readingRank <= 3
         ORDER BY readingDate DESC, createdAt DESC`,
      ).bind(teamId).all<TeamActivityRow>(),
    ]);

    return NextResponse.json({
      team: { ...team, members: membersResult.results },
      journey: journeyResult.results,
      activity: activityResult.results,
    });
  }

  const teamsResult = await env.DB.prepare(
    `SELECT teams.id, teams.name FROM teams
     JOIN team_members ON team_members.team_id = teams.id
     WHERE team_members.user_id = ? ORDER BY teams.created_at DESC`,
  ).bind(user.id).all<TeamRow>();
  const teamRows = teamsResult.results;
  if (teamRows.length === 0) return NextResponse.json({ teams: [] });

  const placeholders = teamRows.map(() => '?').join(',');
  const membersResult = await env.DB.prepare(
    `SELECT team_members.team_id AS teamId, users.id, users.first_name AS firstName, users.last_name AS lastName
     FROM team_members JOIN users ON users.id = team_members.user_id
     WHERE team_members.team_id IN (${placeholders}) ORDER BY team_members.joined_at ASC`,
  ).bind(...teamRows.map((team) => team.id)).all<MemberRow>();

  const teams = teamRows.map((team) => ({
    ...team,
    members: membersResult.results.filter((member) => member.teamId === team.id),
  }));
  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  const body = await request.json<{ action?: 'create' | 'join'; name?: string }>();
  const name = body.name?.trim().replace(/\s+/g, ' ') ?? '';
  if (name.length < 2 || name.length > 60) return jsonError('Team names should be 2–60 characters.');

  if (body.action === 'create') {
    const existing = await env.DB.prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE').bind(name).first();
    if (existing) return jsonError('A team with that name already exists.', 409);
    const teamId = crypto.randomUUID();
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO teams (id, name, created_by, created_at) VALUES (?, ?, ?, ?)').bind(teamId, name, user.id, now),
      env.DB.prepare('INSERT INTO team_members (team_id, user_id, joined_at) VALUES (?, ?, ?)').bind(teamId, user.id, now),
    ]);
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (body.action === 'join') {
    const team = await env.DB.prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE').bind(name).first<{ id: string }>();
    if (!team) return jsonError('We couldn’t find a team with that name.', 404);
    await env.DB.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id, joined_at) VALUES (?, ?, ?)')
      .bind(team.id, user.id, Date.now()).run();
    return NextResponse.json({ ok: true });
  }

  return jsonError('Choose whether to create or join a team.');
}

export async function PATCH(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const body = await request.json<{ teamId?: unknown; description?: unknown }>();
  if (typeof body.teamId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.teamId)) {
    return jsonError('Please choose a valid team.');
  }
  if (typeof body.description !== 'string') return jsonError('Please enter a valid team description.');

  const description = body.description.trim();
  if (description.length > 280) return jsonError('Team descriptions can be up to 280 characters.');

  const membership = await env.DB.prepare(
    'SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?',
  ).bind(body.teamId, user.id).first();
  if (!membership) return jsonError('We couldn’t find that team, or you no longer have access to it.', 404);

  await env.DB.prepare('UPDATE teams SET description = ? WHERE id = ?').bind(description, body.teamId).run();
  return NextResponse.json({ description });
}
