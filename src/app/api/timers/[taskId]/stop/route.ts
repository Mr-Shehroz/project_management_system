// src/app/api/timers/[taskId]/stop/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks, notifications, users } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, or, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { taskId } = await params;

  try {
    // Verify task exists and user is assigned to it
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task[0].assigned_to !== session.user.id) {
      return Response.json({ error: 'Only assigned member can stop timer' }, { status: 403 });
    }

    // Find active timer for this task
    const activeTimer = await db
      .select()
      .from(taskTimers)
      .where(eq(taskTimers.task_id, taskId))
      .limit(1);

    if (activeTimer.length === 0 || activeTimer[0].end_time) {
      return Response.json({ error: 'No active timer found for this task' }, { status: 400 });
    }

    // Calculate duration in SECONDS first
    const startTime = new Date(activeTimer[0].start_time);
    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute

    // Update timer with end time and duration
    await db
      .update(taskTimers)
      .set({
        end_time: endTime,
        duration_minutes: durationMinutes,
      })
      .where(eq(taskTimers.id, activeTimer[0].id));

    // Check if time limit exceeded
    let timeExceeded = false;
    if (task[0].estimated_minutes && durationMinutes > task[0].estimated_minutes) {
      timeExceeded = true;
      
      // Get users to notify (Admin, PM, Team Leader of same team)
      const notifyUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(or(
          eq(users.role, 'ADMIN'),
          eq(users.role, 'PROJECT_MANAGER'),
          and(
            eq(users.role, 'TEAM_LEADER'),
            eq(users.team_type, task[0].team_type)
          )
        ));

      // Create database notifications
      const notificationPromises = notifyUsers.map(user =>
        db.insert(notifications).values({
          id: uuidv4(),
          user_id: user.id,
          task_id: taskId,
          type: 'TIME_EXCEEDED',
          is_read: false,
          created_at: new Date(),
        })
      );

      await Promise.all(notificationPromises);
    }

    return Response.json({ 
      success: true, 
      duration: durationMinutes,
      duration_seconds: durationSeconds, // ✅ Return exact seconds
      timeExceeded
    }, { status: 200 });
  } catch (err) {
    console.error('Stop timer error:', err);
    return Response.json({ error: 'Failed to stop timer' }, { status: 500 });
  }
}