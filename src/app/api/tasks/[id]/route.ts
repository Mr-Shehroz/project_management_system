// src/app/api/tasks/[id]/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get current task to verify ownership
  const currentTask = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (currentTask.length === 0) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const requestData = await request.json();

  // Handle status updates separately from field updates
  if (requestData.status) {
    const { status } = requestData;
    
    // Validate status transitions
    const oldStatus = currentTask[0].status;
    
    // Only assigned member can move from PENDING to IN_PROGRESS
    if (oldStatus === 'PENDING' && status === 'IN_PROGRESS') {
      if (currentTask[0].assigned_to !== session.user.id) {
        return Response.json({ error: 'Only the assigned member can start this task' }, { status: 403 });
      }
    }
    
    // Only assigned member can move from IN_PROGRESS to WAITING_FOR_QA
    if (oldStatus === 'IN_PROGRESS' && status === 'WAITING_FOR_QA') {
      if (currentTask[0].assigned_to !== session.user.id) {
        return Response.json({ error: 'Only the assigned member can submit for QA' }, { status: 403 });
      }
    }
    
    // Only QA can approve or request rework
    if ((status === 'APPROVED' || status === 'REWORK') && session.user.role !== 'QA') {
      return Response.json({ error: 'Only QA can approve or request rework' }, { status: 403 });
    }
    
    // Only Admin/PM/Team Leader can move back to PENDING (for rework handling)
    if (status === 'PENDING' && 
        !['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)) {
      return Response.json({ error: 'Insufficient permissions to reset task status' }, { status: 403 });
    }

    try {
      // Special handling: when moving to WAITING_FOR_QA, clear QA assignment
      if (status === 'WAITING_FOR_QA') {
        await db
          .update(tasks)
          .set({
            status: 'WAITING_FOR_QA',
            qa_assigned_to: null, // Clear previous QA assignment
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));
      } else {
        await db
          .update(tasks)
          .set({
            status: status,
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));
      }

      return Response.json({ success: true }, { status: 200 });
    } catch (err) {
      console.error('Status update error:', err);
      return Response.json({ error: 'Failed to update task status' }, { status: 500 });
    }
  }

  // Handle field updates (title, description, etc.)
  const {
    title,
    description,
    priority,
    assigned_to,
    qa_assigned_to,
    estimated_minutes,
    files,
  } = requestData;

  // Only task assigner or admin can edit fields
  if (
    session.user.role !== 'ADMIN' &&
    session.user.id !== currentTask[0].assigned_by
  ) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Validate required fields
  if (!title || !assigned_to) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate assignee exists and matches team
  const assignee = await db
    .select()
    .from(users)
    .where(and(eq(users.id, assigned_to), eq(users.team_type, currentTask[0].team_type)))
    .limit(1);

  if (assignee.length === 0) {
    return Response.json({ error: 'Invalid assignee or team mismatch' }, { status: 400 });
  }

  // Validate QA user if provided
  let qaUserId: string | null = null;
  if (qa_assigned_to) {
    const qaUser = await db
      .select()
      .from(users)
      .where(eq(users.id, qa_assigned_to))
      .limit(1);
    
    if (qaUser.length === 0 || qaUser[0].role !== 'QA') {
      return Response.json({ error: 'Invalid QA user' }, { status: 400 });
    }
    qaUserId = qaUser[0].id;
  }

  try {
    // Handle files (optional)
    let filesJson = null;
    if (Array.isArray(files) && files.length > 0) {
      filesJson = JSON.stringify(files);
    }

    await db
      .update(tasks)
      .set({
        title,
        description: description || null,
        priority: priority || 'MEDIUM',
        assigned_to,
        qa_assigned_to: qaUserId,
        estimated_minutes: estimated_minutes ? parseInt(estimated_minutes, 10) : null,
        files: filesJson,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, id));

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Field update error:', err);
    return Response.json({ error: 'Failed to update task' }, { status: 500 });
  }
}