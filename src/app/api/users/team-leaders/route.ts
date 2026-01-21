// src/app/api/users/team-leaders/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const teamLeaders = await db
      .select({
        id: users.id,
        name: users.name,
        team_type: users.team_type,
      })
      .from(users)
      .where(eq(users.role, 'TEAM_LEADER'));

    return Response.json({ teamLeaders });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch team leaders' }, { status: 500 });
  }
}