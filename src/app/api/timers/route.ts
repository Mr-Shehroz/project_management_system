// src/app/api/timers/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_id } = await request.json();

  if (!task_id) {
    return Response.json({ error: 'Task ID is required' }, { status: 400 });
  }

  try {
    // Verify task exists and user is assigned to it
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task[0].assigned_to !== session.user.id) {
      return Response.json({ error: 'Only assigned member can start timer' }, { status: 403 });
    }

    // Check if task is APPROVED (no timer allowed)
    if (task[0].status === 'APPROVED') {
      return Response.json({ error: 'Cannot start timer on approved task' }, { status: 400 });
    }

    // Check if there's already a completed timer for this task
    const existingTimer = await db
      .select()
      .from(taskTimers)
      .where(eq(taskTimers.task_id, task_id))
      .limit(1);

    if (existingTimer.length > 0 && existingTimer[0].end_time) {
      return Response.json({ error: 'Timer has already been used for this task' }, { status: 400 });
    }

    // Check if there's an active timer
    if (existingTimer.length > 0 && !existingTimer[0].end_time) {
      return Response.json({ error: 'Timer is already running for this task' }, { status: 400 });
    }

    // Create new timer
    await db.insert(taskTimers).values({
      id: uuidv4(),
      task_id: task_id,
      start_time: new Date(),
      is_rework: task[0].status === 'REWORK',
      created_at: new Date(),
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Start timer error:', err);
    return Response.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}