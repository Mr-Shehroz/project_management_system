// src/app/api/users/qa/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only authorized roles can view QA users
  if (!['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const qas = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        team_type: users.team_type,
        role: users.role,
      })
      .from(users)
      .where(eq(users.role, 'QA'));

    return Response.json({ qas });
  } catch (err) {
    console.error('Get QA users error:', err);
    return Response.json({ error: 'Failed to fetch QA users' }, { status: 500 });
  }
}