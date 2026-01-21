// src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { notifications, tasks, projects } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

// GET unread notifications for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch notifications with project name
    const notificationList = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        created_at: notifications.created_at,
        is_read: notifications.is_read,
        task_id: notifications.task_id,
        project_name: projects.name,
      })
      .from(notifications)
      .innerJoin(tasks, eq(notifications.task_id, tasks.id))
      .innerJoin(projects, eq(tasks.project_id, projects.id))
      .where(eq(notifications.user_id, session.user.id))
      .orderBy(desc(notifications.created_at))
      .limit(20);

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
    console.error(err);
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
    console.error(err);
    return Response.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}