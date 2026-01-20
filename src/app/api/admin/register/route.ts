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

  // Only admin can create users
  if (!session || session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, username, password, role, team_type, team_leader_id } =
    await req.json();

  // Validation
  if (!name || !username || !password || !role || !team_type) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate role and team_type against allowed enums
  const validRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'DEVELOPER', 'DESIGNER', 'PROGRAMMER', 'QA'];
  const validTeamTypes = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'DEVELOPER', 'DESIGNER', 'PROGRAMMER', 'QA'];

  if (!validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }
  if (!validTeamTypes.includes(team_type)) {
    return Response.json({ error: 'Invalid team_type' }, { status: 400 });
  }

  // Check if username already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ error: 'Username already taken' }, { status: 409 });
  }

  // Hash password
  const hashedPassword = await hash(password, 10);

  // Insert user — ONLY use columns that exist in your schema
  await db.insert(users).values({
    id: uuidv4(),
    name,
    username, // ✅ Correct: use `username`, NOT `email`
    password: hashedPassword,
    role,
    team_type,
    team_leader_id: team_leader_id || null,
    is_active: true,
    created_at: new Date(),
  });

  return Response.json({ success: true }, { status: 201 });
}