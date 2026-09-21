import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getSessionUser, jsonError } from '@/lib/server';

type TeamRow = { id: string; name: string };
type MemberRow = { teamId: string; id: string; firstName: string; lastName: string };

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
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
