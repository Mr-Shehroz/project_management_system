// src/app/api/users/team/route.ts
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

  // Only allow certain roles to see team members
  const allowedRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'];
  if (!allowedRoles.includes(session.user.role)) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const teamMembers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        team_type: users.team_type,
      })
      .from(users)
      .where(eq(users.is_active, true));

    return Response.json({ users: teamMembers });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}