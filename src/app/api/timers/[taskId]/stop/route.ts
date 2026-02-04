// src/app/api/timers/[taskId]/stop/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, notifications, users, tasks } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, or, and, isNull } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> } // ✅ params is a Promise
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ MUST await params to get the actual value
  const { taskId } = await params;

  try {
    // Get active timer for this task that is not ended
    const activeTimer = await db
      .select()
      .from(taskTimers)
      .where(and(
        eq(taskTimers.task_id, taskId),
        isNull(taskTimers.end_time)
      ))
      .limit(1);

    if (activeTimer.length === 0) {
      return Response.json({ error: 'No active timer' }, { status: 400 });
    }

    const timer = activeTimer[0];
    const startTime = new Date(timer.start_time);
    const now = Date.now();
    const durationSeconds = Math.floor((now - startTime.getTime()) / 1000);

    // Get estimated_minutes from task
    let estimatedMinutes = 0;
    const task = await db
      .select({ estimated_minutes: tasks.estimated_minutes })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length > 0 && typeof task[0].estimated_minutes === 'number') {
      estimatedMinutes = task[0].estimated_minutes;
    }
    const timeExceeded = estimatedMinutes > 0 && durationSeconds > estimatedMinutes * 60;

    // Stop timer (set end_time)
    await db
      .update(taskTimers)
      .set({ end_time: new Date() })
      .where(eq(taskTimers.id, timer.id));

    // Notify oversight (ADMIN, PM, TEAM_LEADER)
    if (durationSeconds > 0) {
      const oversightUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(
          eq(users.role, 'ADMIN'),
          eq(users.role, 'PROJECT_MANAGER'),
          eq(users.role, 'TEAM_LEADER')
        ));

      const notificationPromises = oversightUsers.map(user =>
        db.insert(notifications).values({
          id: uuidv4(),
          user_id: user.id,
          task_id: taskId,
          type: 'TASK_COMPLETED',
          is_read: false,
          created_at: new Date(),
        })
      );
      await Promise.all(notificationPromises);
    }

    return Response.json({
      success: true,
      duration_seconds: durationSeconds,
      estimated_minutes: estimatedMinutes,
      timeExceeded: timeExceeded
    }, { status: 200 });
  } catch (err) {
    console.error('Stop timer error:', err);
    return Response.json({ error: 'Failed to stop timer' }, { status: 500 });
  }
}