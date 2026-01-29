// src/app/api/help-request/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { notifications, tasks, users } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, or, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only allow non-admin users to request help
  if (['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'QA'].includes(session.user.role)) {
    return Response.json({ error: 'Admins cannot request help' }, { status: 403 });
  }

  const { task_id } = await request.json();

  if (!task_id) {
    return Response.json({ error: 'Task ID is required' }, { status: 400 });
  }

  try {
    // Verify task exists
    const task = await db
      .select({ project_id: tasks.project_id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get all users who should receive help notifications
    const notifyUsers = await db
      .select({ id: users.id, role: users.role, team_type: users.team_type })
      .from(users)
      .where(or(
        eq(users.role, 'ADMIN'),
        eq(users.role, 'PROJECT_MANAGER'),
        and(
          eq(users.role, 'TEAM_LEADER'),
          eq(users.team_type, session.user.team_type) // Only team leader of same team
        )
      ));

    // Create notifications for each user
    const notificationPromises = notifyUsers.map(user =>
      db.insert(notifications).values({
        id: uuidv4(),
        user_id: user.id,
        task_id: task_id,
        type: 'HELP_REQUEST',
        is_read: false,
        created_at: new Date(),
      })
    );

    await Promise.all(notificationPromises);

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Help request error:', err);
    return Response.json({ error: 'Failed to send help request' }, { status: 500 });
  }
}