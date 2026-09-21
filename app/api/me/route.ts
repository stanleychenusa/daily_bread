import { NextResponse } from 'next/server';

import { getSessionUser, jsonError } from '@/lib/server';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Please sign in.', 401);
  return NextResponse.json({ user });
}
