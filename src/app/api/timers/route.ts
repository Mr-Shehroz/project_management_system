// src/app/api/timers/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { task_id } = await request.json();

    if (!task_id) {
      return Response.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Verify task exists and user is assigned
    const taskRes = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (taskRes.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskRes[0];

    if (task.assigned_to !== session.user.id) {
      return Response.json({ error: 'Only assigned member can start timer' }, { status: 403 });
    }

    // Check if there's already an active timer
    const activeTimer = await db
      .select()
      .from(taskTimers)
      .where(
        and(
          eq(taskTimers.task_id, task_id),
          isNull(taskTimers.end_time)
        )
      )
      .limit(1);

    if (activeTimer.length > 0) {
      return Response.json({ error: 'Timer is already running' }, { status: 400 });
    }

    // Create new timer
    await db.insert(taskTimers).values({
      id: uuidv4(),
      task_id: task_id,
      start_time: new Date(),
      is_rework: task.status === 'REWORK',
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Start timer error:', err);
    return Response.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}