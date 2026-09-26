import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getSessionUser, jsonError } from '@/lib/server';

type TeamRow = { id: string; name: string; joinCode: string };
type TeamDetailRow = TeamRow & { description: string; createdBy: string };
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

async function createTeamJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const existing = await env.DB.prepare('SELECT 1 FROM teams WHERE join_code = ?').bind(joinCode).first();
    if (!existing) return joinCode;
  }
  throw new Error('Could not create a unique Team ID.');
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
      `SELECT teams.id, teams.name, teams.join_code AS joinCode,
              COALESCE(teams.description, '') AS description, teams.created_by AS createdBy FROM teams
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
      team: {
        id: team.id,
        name: team.name,
        joinCode: team.joinCode,
        description: team.description,
        ownerId: team.createdBy,
        isOwner: team.createdBy === user.id,
        members: membersResult.results,
      },
      journey: journeyResult.results,
      activity: activityResult.results,
    });
  }

  const teamsResult = await env.DB.prepare(
    `SELECT teams.id, teams.name, teams.join_code AS joinCode FROM teams
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
  const body = await request.json<{ action?: 'create' | 'join'; name?: unknown; teamId?: unknown }>();

  if (body.action === 'create') {
    if (typeof body.name !== 'string') return jsonError('Please enter a team name.');
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) return jsonError('Team names should be 2–60 characters.');
    const teamId = crypto.randomUUID();
    const joinCode = await createTeamJoinCode();
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO teams (id, name, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(teamId, name, joinCode, user.id, now),
      env.DB.prepare('INSERT INTO team_members (team_id, user_id, joined_at) VALUES (?, ?, ?)').bind(teamId, user.id, now),
    ]);
    return NextResponse.json({ ok: true, team: { id: teamId, name, joinCode } }, { status: 201 });
  }

  if (body.action === 'join') {
    if (typeof body.teamId !== 'string') return jsonError('Please enter a Team ID.');
    const joinCode = body.teamId.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(joinCode)) {
      return jsonError('Please enter a valid Team ID.');
    }
    const team = await env.DB.prepare(
      'SELECT id, name, join_code AS joinCode FROM teams WHERE join_code = ?',
    ).bind(joinCode).first<TeamRow>();
    if (!team) return jsonError('We couldn’t find a team with that ID.', 404);
    await env.DB.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id, joined_at) VALUES (?, ?, ?)')
      .bind(team.id, user.id, Date.now()).run();
    return NextResponse.json({ ok: true, team });
  }

  return jsonError('Choose whether to create or join a team.');
}

export async function PATCH(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const body = await request.json<{ teamId?: unknown; name?: unknown; description?: unknown }>();
  if (typeof body.teamId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.teamId)) {
    return jsonError('Please choose a valid team.');
  }
  const ownedTeam = await env.DB.prepare(
    'SELECT 1 FROM teams WHERE id = ? AND created_by = ?',
  ).bind(body.teamId, user.id).first();
  if (!ownedTeam) return jsonError('Only the team owner can change the team name or description.', 403);

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return jsonError('Please enter a valid team name.');
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) return jsonError('Team names should be 2–60 characters.');
    await env.DB.prepare('UPDATE teams SET name = ? WHERE id = ?').bind(name, body.teamId).run();
    return NextResponse.json({ name });
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') return jsonError('Please enter a valid team description.');
    const description = body.description.trim();
    if (description.length > 280) return jsonError('Team descriptions can be up to 280 characters.');
    await env.DB.prepare('UPDATE teams SET description = ? WHERE id = ?').bind(description, body.teamId).run();
    return NextResponse.json({ description });
  }

  return jsonError('Choose a team detail to update.');
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);

  const teamId = new URL(request.url).searchParams.get('teamId');
  const memberId = new URL(request.url).searchParams.get('memberId');
  if (!teamId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId)) {
    return jsonError('Please choose a valid team.');
  }

  const ownedTeam = await env.DB.prepare(
    'SELECT id FROM teams WHERE id = ? AND created_by = ?',
  ).bind(teamId, user.id).first();
  if (!ownedTeam) return jsonError('Only the team owner can manage its members or delete it.', 403);

  if (memberId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId)) {
      return jsonError('Please choose a valid team member.');
    }
    if (memberId === user.id) return jsonError('The team owner cannot remove themselves.', 400);

    const membership = await env.DB.prepare(
      'SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?',
    ).bind(teamId, memberId).first();
    if (!membership) return jsonError('That person is no longer a member of this team.', 404);

    await env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamId, memberId).run();
    return NextResponse.json({ ok: true, removedMemberId: memberId });
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(teamId),
    env.DB.prepare('DELETE FROM teams WHERE id = ? AND created_by = ?').bind(teamId, user.id),
  ]);
  return NextResponse.json({ ok: true });
}
