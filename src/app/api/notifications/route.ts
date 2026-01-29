// src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { notifications, tasks, projects, users } from '@/db/schema';
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
        id: notifications.id,
        user_id: notifications.user_id,
        task_id: notifications.task_id,
        type: notifications.type,
        is_read: notifications.is_read,
        created_at: notifications.created_at,
        task_title: tasks.title,
        project_name: projects.name,
        requester_name: users.name, // ✅ Add requester name for help requests
      })
      .from(notifications)
      .innerJoin(tasks, eq(notifications.task_id, tasks.id))
      .innerJoin(projects, eq(tasks.project_id, projects.id))
      .innerJoin(users, eq(tasks.assigned_to, users.id)) // This gives the requester
      .where(eq(notifications.user_id, session.user.id))
      .orderBy(desc(notifications.created_at))
      .limit(50);

    // Count unread notifications
    const unreadCountRows = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, session.user.id),
          eq(notifications.is_read, false)
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
      .update(notifications)
      .set({ is_read: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.user_id, session.user.id)
        )
      );

    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to update notification:', err);
    return Response.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}