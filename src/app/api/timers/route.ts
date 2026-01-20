// src/app/api/timers/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull } from 'drizzle-orm';

// POST /api/timers → start timer
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_id } = await req.json();

  // Verify user is assigned to this task
  const task = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, task_id), eq(tasks.assigned_to, session.user.id)))
    .limit(1);

  if (task.length === 0) {
    return Response.json({ error: 'Not authorized for this task' }, { status: 403 });
  }

  try {
    // Stop any existing active timer for this task
    await db
      .update(taskTimers)
      .set({ end_time: new Date() })
      .where(and(eq(taskTimers.task_id, task_id), isNull(taskTimers.end_time)));

    // Start new timer
    await db.insert(taskTimers).values({
      id: uuidv4(),
      task_id,
      start_time: new Date(),
      is_rework: false,
    });

    // Update task started_at if not set
    if (!task[0].started_at) {
      await db
        .update(tasks)
        .set({ started_at: new Date() })
        .where(eq(tasks.id, task_id));
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}