// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  // Only allow Admin, PM, Team Leader
  const allowedRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'];
  if (!session || !allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const data = await request.json();

  try {
    // Validate role changes (only Admin can change to Admin/PM)
    if (data.role && session.user.role !== 'ADMIN') {
      const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (user.length > 0 && user[0].role === 'ADMIN') {
        return NextResponse.json({ error: 'Only Admin can modify Admin users' }, { status: 403 });
      }
      if (['ADMIN', 'PROJECT_MANAGER'].includes(data.role)) {
        return NextResponse.json({ error: 'Only Admin can assign Admin/PM roles' }, { status: 403 });
      }
    }

    await db
      .update(users)
      .set({
        name: data.name,
        username: data.username,
        role: data.role,
        team_type: data.team_type,
        team_leader_id: data.team_leader_id || null,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  // Only Admin can delete users
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only Admin can delete users' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if user exists
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (user.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete user
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}