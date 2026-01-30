// src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { notifications as notificationsTable, tasks, projects, users } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

// GET notifications for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get notifications with task title, project name, and requester name for help requests
    const notificationList = await db
      .select({
        id: notificationsTable.id,
        user_id: notificationsTable.user_id,
        task_id: notificationsTable.task_id,
        type: notificationsTable.type,
        is_read: notificationsTable.is_read,
        created_at: notificationsTable.created_at,
        task_title: tasks.title,
        project_name: projects.name,
        requester_name: users.name,
      })
      .from(notificationsTable)
      .innerJoin(tasks, eq(notificationsTable.task_id, tasks.id))
      .innerJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(users, eq(tasks.assigned_to, users.id)) // Use leftJoin for cases where assigned_to might be null
      .where(eq(notificationsTable.user_id, session.user.id))
      .orderBy(desc(notificationsTable.created_at));

    // Count unread notifications
    const unreadCountRows = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.user_id, session.user.id),
          eq(notificationsTable.is_read, false)
        )
      );
    const unreadCount = unreadCountRows?.[0]?.count ?? 0;

    return Response.json({
      notifications: notificationList,
      unreadCount: unreadCount,
    });
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return Response.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST mark as read
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { notificationId } = await req.json();

  if (!notificationId) {
    return Response.json({ error: 'Notification ID is required' }, { status: 400 });
  }

  try {
    await db
      .update(notificationsTable)
      .set({ is_read: true })
      .where(
        and(
          eq(notificationsTable.id, notificationId),
          eq(notificationsTable.user_id, session.user.id)
        )
      );

    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to update notification:', err);
    return Response.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}