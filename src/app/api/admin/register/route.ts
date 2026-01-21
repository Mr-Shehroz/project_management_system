// src/app/api/admin/register/route.ts
import { NextRequest } from 'next/server';
import { hash } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, username, password, role, team_type, team_leader_id } =
    await req.json();

  if (!name || !username || !password || !role) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'DEVELOPER', 'DESIGNER', 'PROGRAMMER', 'QA'];
  if (!validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  const nonTeamRoles = ['ADMIN', 'PROJECT_MANAGER', 'QA'];
  
  if (nonTeamRoles.includes(role)) {
    if (team_type && team_type !== 'null' && team_type !== '') {
      return Response.json({ error: `${role} cannot be assigned to a team` }, { status: 400 });
    }
  } else {
    const validTeamTypes = ['DEVELOPER', 'DESIGNER', 'PROGRAMMER'];
    if (!team_type || !validTeamTypes.includes(team_type)) {
      return Response.json({ error: 'Valid team type is required for this role' }, { status: 400 });
    }
  }

  // Validate team_leader_id if provided
  if (team_leader_id) {
    const teamLeader = await db
      .select()
      .from(users)
      .where(eq(users.id, team_leader_id))
      .limit(1);

    if (teamLeader.length === 0 || teamLeader[0].role !== 'TEAM_LEADER') {
      return Response.json({ error: 'Invalid team leader' }, { status: 400 });
    }

    if (teamLeader[0].team_type !== team_type) {
      return Response.json({ error: 'Team type must match team leader\'s team type' }, { status: 400 });
    }
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ error: 'Username already taken' }, { status: 409 });
  }

  const hashedPassword = await hash(password, 10);

  await db.insert(users).values({
    id: uuidv4(),
    name,
    username,
    password: hashedPassword,
    role,
    team_type: nonTeamRoles.includes(role) ? null : team_type,
    team_leader_id: team_leader_id || null,
    is_active: true,
    created_at: new Date(),
  });

  return Response.json({ success: true }, { status: 201 });
}