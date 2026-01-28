// src/app/api/tasks/[id]/assign-qa/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users, notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { qa_id } = await request.json();

    // Validate inputs
    if (!id || !qa_id) {
      console.error('Missing required fields:', { id, qa_id });
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify task exists
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (task.length === 0) {
      console.error('Task not found:', id);
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // ✅ Check if QA was already assigned
    if (task[0].qa_assigned_to && task[0].qa_assigned_at) {
      console.error('QA already assigned:', { taskId: id, qaId: task[0].qa_assigned_to });
      return Response.json({ 
        error: 'QA has already been assigned to this task. Reassignment is not allowed.' 
      }, { status: 400 });
    }

    // Verify task is in WAITING_FOR_QA status
    if (task[0].status !== 'WAITING_FOR_QA') {
      console.error('Task is not waiting for QA:', { taskId: id, status: task[0].status });
      return Response.json({ error: 'Can only assign QA to tasks waiting for review' }, { status: 400 });
    }

    // Verify user has permission
    if (!['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)) {
      console.error('Insufficient permissions:', session.user.role);
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify QA user exists and has QA role
    const qaUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, qa_id), eq(users.role, 'QA')))
      .limit(1);

    if (qaUser.length === 0) {
      console.error('Invalid QA user:', qa_id);
      return Response.json({ error: 'Invalid QA user' }, { status: 400 });
    }

    // ✅ Assign QA with timestamp
    await db
      .update(tasks)
      .set({
        qa_assigned_to: qa_id,
        qa_assigned_at: new Date(), // ✅ Set assignment timestamp
        updated_at: new Date(),
      })
      .where(eq(tasks.id, id));

    // Create notification for QA
    await db.insert(notifications).values({
      id: uuidv4(),
      user_id: qa_id,
      task_id: id,
      type: 'QA_REVIEWED',
      is_read: false,
      created_at: new Date(),
    });

    console.log('✅ QA assigned successfully:', { taskId: id, qaId: qa_id });

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Assign QA error:', err);
    return Response.json({ error: 'Failed to assign QA' }, { status: 500 });
  }
}