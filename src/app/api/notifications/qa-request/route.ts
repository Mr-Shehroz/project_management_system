// src/app/api/notifications/qa-request/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Correct path alias for Next.js
import { db } from '@/db';
import { notifications, tasks, users } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, or } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_id, project_id } = await req.json();

  if (!task_id || !project_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Get task details
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get all users who should be notified:
    // - Admin
    // - Project Manager
    // - Team Leader (if exists)
    const adminAndPM = await db
      .select({ id: users.id })
      .from(users)
      .where(or(
        eq(users.role, 'ADMIN'),
        eq(users.role, 'PROJECT_MANAGER')
      ));

    // Get team leader for this team
    let teamLeader: { id: string }[] = [];
    if (task[0].team_type) {
      teamLeader = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.role, 'TEAM_LEADER'),
          eq(users.team_type, task[0].team_type)
        ));
    }

    // Combine all recipients, ensuring uniqueness
    const recipientIds = Array.from(new Set([
      ...adminAndPM.map(u => u.id),
      ...teamLeader.map(u => u.id)
    ]));

    // Only send notifications to valid users
    if (recipientIds.length === 0) {
      return Response.json({ error: 'No eligible users to notify' }, { status: 400 });
    }

    // Only use allowed notification types as per schema
    // Use 'READY_FOR_ASSIGNMENT', which fits the QA request intent.
    const notificationPromises = recipientIds.map(recipientId =>
      db.insert(notifications).values({
        id: uuidv4(),
        user_id: recipientId,
        task_id: task_id,
        type: 'READY_FOR_ASSIGNMENT',
        is_read: false,
        created_at: new Date(),
      })
    );

    await Promise.all(notificationPromises);

    // Return success response
    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('QA request notification error:', err);
    return Response.json({ error: 'Failed to create notifications' }, { status: 500 });
  }
}