// src/app/api/timers/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { task_id } = await request.json();

    if (!task_id) {
      return Response.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Get task with estimated minutes
    const task = await db
      .select({ id: tasks.id, estimated_minutes: tasks.estimated_minutes })
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Create timer with countdown info
    await db.insert(taskTimers).values({
      id: uuidv4(),
      task_id: task_id,
      start_time: new Date(),
      duration_minutes: task[0].estimated_minutes,
      is_rework: false,
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Start timer error:', err);
    return Response.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}