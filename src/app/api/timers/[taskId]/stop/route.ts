// src/app/api/timers/[taskId]/stop/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find active timer for current user's task
    const activeTimer = await db
      .select()
      .from(taskTimers)
      .innerJoin(tasks, eq(taskTimers.task_id, tasks.id))
      .where(
        and(
          eq(tasks.assigned_to, session.user.id),
          isNull(taskTimers.end_time) // FIX: use isNull
        )
      )
      .limit(1);

    if (activeTimer.length === 0) {
      return Response.json({ error: 'No active timer' }, { status: 400 });
    }

    const timer = activeTimer[0].task_timers;
    const now = new Date();
    const durationMs = now.getTime() - new Date(timer.start_time).getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    await db
      .update(taskTimers)
      .set({
        end_time: now,
        duration_minutes: durationMinutes,
      })
      .where(eq(taskTimers.id, timer.id));

    return Response.json({ success: true, duration: durationMinutes });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to stop timer' }, { status: 500 });
  }
}