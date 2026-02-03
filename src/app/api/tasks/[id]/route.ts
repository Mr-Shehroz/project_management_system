// src/app/api/tasks/[id]/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users, projects, notifications, taskTimers } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
  const currentTaskArr = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (currentTaskArr.length === 0) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const currentTask = currentTaskArr[0];

  const requestData = await request.json();

  // --- NEW LOGIC: Comprehensive Status Updates (+ Notifications) ---
  if (requestData.status !== undefined) {
    const { status } = requestData;
    const oldStatus = currentTask.status;
    const newStatus = status;

    // ✅ CLEAR QA ASSIGNMENT when task goes to REWORK
    if (status === 'REWORK' && oldStatus !== 'REWORK') {
      // Only QA can approve or request rework
      if (session.user.role !== 'QA') {
        return Response.json({ error: 'Only QA can approve or request rework' }, { status: 403 });
      }
      try {
        await db
          .update(tasks)
          .set({
            status: 'REWORK',
            qa_assigned_to: null,
            qa_assigned_at: null,
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));

        // Create notification for rework
        const notifyUsers = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(
            or(
              eq(users.role, 'ADMIN'),
              eq(users.role, 'PROJECT_MANAGER'),
              eq(users.role, 'TEAM_LEADER'),
              eq(users.id, currentTask.assigned_to) // Original assignee
            )
          );

        const notificationPromises = notifyUsers.map(user =>
          db.insert(notifications).values({
            id: uuidv4(),
            user_id: user.id,
            task_id: id,
            type: 'TASK_REWORK',
            is_read: false,
            created_at: new Date(),
          })
        );

        await Promise.all(notificationPromises);

        return Response.json({ success: true }, { status: 200 });
      } catch (err) {
        console.error('Rework update error:', err);
        return Response.json({ error: 'Failed to update task status' }, { status: 500 });
      }
    }

    // Only assigned member can move from IN_PROGRESS to WAITING_FOR_QA
    if (oldStatus === 'IN_PROGRESS' && newStatus === 'WAITING_FOR_QA') {
      if (currentTask.assigned_to !== session.user.id) {
        return Response.json({ error: 'Only the assigned member can submit for QA' }, { status: 403 });
      }
    }

    // Only QA can approve
    if (newStatus === 'APPROVED' && session.user.role !== 'QA') {
      return Response.json({ error: 'Only QA can approve' }, { status: 403 });
    }

    // Only Admin/PM/Team Leader can move back to PENDING
    if (
      newStatus === 'PENDING' &&
      !['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)
    ) {
      return Response.json({ error: 'Insufficient permissions to reset task status' }, { status: 403 });
    }

    // --- REWRITE: Special handling for REWORK->WAITING_FOR_QA transition per prompt ---
    if (oldStatus === 'REWORK' && status === 'WAITING_FOR_QA') {
      try {
        // Get the QA who was originally assigned
        const qaUserId = currentTask.qa_assigned_to;

        if (qaUserId) {
          // Create notification for the assigned QA
          await db.insert(notifications).values({
            id: uuidv4(),
            user_id: qaUserId,
            task_id: id,
            type: 'TASK_RESUBMITTED',
            is_read: false,
            created_at: new Date(),
          });
        }
        // Also notify Admin/PM/Team Leader for oversight
        const oversightUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(or(
            eq(users.role, 'ADMIN'),
            eq(users.role, 'PROJECT_MANAGER'),
            eq(users.role, 'TEAM_LEADER')
          ));

        const oversightPromises = oversightUsers.map(user =>
          db.insert(notifications).values({
            id: uuidv4(),
            user_id: user.id,
            task_id: id,
            type: 'TASK_RESUBMITTED',
            is_read: false,
            created_at: new Date(),
          })
        );

        await Promise.all([...(qaUserId ? [Promise.resolve()] : []), ...oversightPromises]);
        // Update task status
        await db
          .update(tasks)
          .set({
            status: 'WAITING_FOR_QA',
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));

        return Response.json({ success: true }, { status: 200 });
      } catch (err) {
        console.error('Resubmission notification error:', err);
        return Response.json({ error: 'Failed to update task status' }, { status: 500 });
      }
    }

    // --- rest of your existing status handling logic ---
    try {
      // Notifications logic per instructions.
      // Only send notifications if the new status is different.
      if (newStatus !== oldStatus) {
        // APPROVED sends to admins, PM, leader, and original assignee.
        if (newStatus === 'APPROVED') {
          const notifyUsers = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(
              or(
                eq(users.role, 'ADMIN'),
                eq(users.role, 'PROJECT_MANAGER'),
                eq(users.role, 'TEAM_LEADER'),
                eq(users.id, currentTask.assigned_to)
              )
            );
          const notificationPromises = notifyUsers.map(user =>
            db.insert(notifications).values({
              id: uuidv4(),
              user_id: user.id,
              task_id: id,
              type: 'TASK_APPROVED',
              is_read: false,
              created_at: new Date(),
            })
          );
          await Promise.all(notificationPromises);
        }
        // Initial submit to WAITING_FOR_QA from IN_PROGRESS: notify QA
        else if (newStatus === 'WAITING_FOR_QA' && oldStatus === 'IN_PROGRESS') {
          // Try to get the QA assigned, fall back to PROJECT_MANAGER if no QA present.
          let qaUserId: string | null = null;
          if (currentTask.qa_assigned_to) {
            qaUserId = currentTask.qa_assigned_to;
          } else {
            // Get a PM (if any) as fallback
            const pm = await db.select({ id: users.id }).from(users).where(eq(users.role, 'PROJECT_MANAGER')).limit(1);
            if (pm.length > 0) {
              qaUserId = pm[0].id;
            }
          }
          if (qaUserId) {
            await db.insert(notifications).values({
              id: uuidv4(),
              user_id: qaUserId,
              task_id: id,
              type: 'QA_REVIEWED',
              is_read: false,
              created_at: new Date(),
            });
          }
        }
      }

      // WAITING_FOR_QA: clear QA assignment (unless REWORK branch, which we now handle above)
      if (newStatus === 'WAITING_FOR_QA' && !(oldStatus === 'REWORK')) {
        await db
          .update(tasks)
          .set({
            status: 'WAITING_FOR_QA',
            qa_assigned_to: null,
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));
        return Response.json({ success: true }, { status: 200 });
      }
      // READY_FOR_ASSIGNMENT notification logic (unchanged from original)
      else if (newStatus === 'READY_FOR_ASSIGNMENT') {
        // Get the relevant team_type (from request body or use existing)
        let team_type = requestData.team_type;
        if (!team_type) {
          team_type = currentTask.team_type as string;
        }
        if (!team_type) {
          return Response.json({ error: 'Missing team_type for READY_FOR_ASSIGNMENT' }, { status: 400 });
        }

        // Get all users who should receive READY_FOR_ASSIGNMENT notifications
        const assignUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              eq(users.role, 'ADMIN'),
              eq(users.role, 'PROJECT_MANAGER'),
              and(eq(users.role, 'TEAM_LEADER'), eq(users.team_type, team_type))
            )
          );

        const notificationPromises = assignUsers.map(user =>
          db.insert(notifications).values({
            id: uuidv4(),
            user_id: user.id,
            task_id: id,
            type: 'READY_FOR_ASSIGNMENT',
            is_read: false,
            created_at: new Date(),
          })
        );
        await Promise.all(notificationPromises);

        // Update the task's status
        await db
          .update(tasks)
          .set({
            // @ts-expect-error: Allow wider status for READY_FOR_ASSIGNMENT
            status: 'READY_FOR_ASSIGNMENT',
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));

        return Response.json({ success: true }, { status: 200 });
      } else {
        // For any other status change
        await db
          .update(tasks)
          .set({
            status: newStatus,
            updated_at: new Date(),
          })
          .where(eq(tasks.id, id));
        return Response.json({ success: true }, { status: 200 });
      }
    } catch (err) {
      console.error('Status update error:', err);
      return Response.json({ error: 'Failed to update task status' }, { status: 500 });
    }
  }

  // Determine if this is a full update (Edit Task Modal) or partial update (Inline Editing)
  const isFullUpdate =
    requestData.project_id !== undefined ||
    requestData.team_type !== undefined ||
    requestData.assigned_to !== undefined;

  // Permission check
  const canEditFields =
    session.user.role === 'ADMIN' ||
    session.user.role === 'PROJECT_MANAGER' ||
    session.user.role === 'TEAM_LEADER';

  if (!canEditFields) {
    return Response.json({ error: 'Insufficient permissions to edit task fields' }, { status: 403 });
  }

  // Build update fields object
  const updateFields: any = {};

  // Handle full update validation (Edit Task Modal)
  if (isFullUpdate) {
    if (!requestData.project_id || !requestData.team_type || !requestData.assigned_to) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate project exists
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, requestData.project_id))
      .limit(1);

    if (project.length === 0) {
      return Response.json({ error: 'Invalid project' }, { status: 400 });
    }

    // Validate team_type
    const validTeamTypes = ['DEVELOPER', 'DESIGNER', 'PROGRAMMER'];
    if (!validTeamTypes.includes(requestData.team_type)) {
      return Response.json({ error: 'Invalid team type' }, { status: 400 });
    }

    // Validate assignee exists and matches team
    const assignee = await db
      .select()
      .from(users)
      .where(and(eq(users.id, requestData.assigned_to), eq(users.team_type, requestData.team_type)))
      .limit(1);

    if (assignee.length === 0) {
      return Response.json({ error: 'Invalid assignee or team mismatch' }, { status: 400 });
    }

    updateFields.project_id = requestData.project_id;
    updateFields.team_type = requestData.team_type;
    updateFields.assigned_to = requestData.assigned_to;
  }

  // Handle title (both full and partial)
  if (requestData.title !== undefined) {
    if (requestData.title.trim() === '') {
      return Response.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    updateFields.title = requestData.title.trim();
  }

  // Handle description (both full and partial)
  if (requestData.description !== undefined) {
    updateFields.description = requestData.description.trim() || null;
  }

  // Handle priority (both full and partial)
  if (requestData.priority !== undefined) {
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    if (!validPriorities.includes(requestData.priority)) {
      return Response.json({ error: 'Invalid priority' }, { status: 400 });
    }
    updateFields.priority = requestData.priority;
  }

  // Handle QA Assigned To (both full and partial)
  if (requestData.qa_assigned_to !== undefined) {
    if (requestData.qa_assigned_to === null) {
      updateFields.qa_assigned_to = null;
    } else {
      const qaUser = await db
        .select()
        .from(users)
        .where(eq(users.id, requestData.qa_assigned_to))
        .limit(1);

      if (qaUser.length === 0 || qaUser[0].role !== 'QA') {
        return Response.json({ error: 'Invalid QA user' }, { status: 400 });
      }
      updateFields.qa_assigned_to = requestData.qa_assigned_to;
    }
  }

  // Handle Estimated Minutes (both full and partial)
  if (requestData.estimated_minutes !== undefined) {
    if (requestData.estimated_minutes === null) {
      updateFields.estimated_minutes = null;
    } else {
      const minutes = parseInt(requestData.estimated_minutes, 10);
      if (isNaN(minutes) || minutes < 0) {
        return Response.json({ error: 'Invalid estimated minutes' }, { status: 400 });
      }
      updateFields.estimated_minutes = minutes;
    }
  }

  // Handle Files (both full and partial)
  if (requestData.files !== undefined) {
    if (Array.isArray(requestData.files)) {
      updateFields.files = JSON.stringify(requestData.files);
    } else {
      return Response.json({ error: 'Invalid files format' }, { status: 400 });
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // ---- Auto-start timer if assigned_to changes and is not a QA ----
  if (
    updateFields.assigned_to &&
    updateFields.assigned_to !== currentTask.assigned_to
  ) {
    const assignedUserArr = await db
      .select()
      .from(users)
      .where(eq(users.id, updateFields.assigned_to))
      .limit(1);

    if (assignedUserArr.length > 0 && assignedUserArr[0].role !== 'QA') {
      try {
        await db.insert(taskTimers).values({
          id: uuidv4(),
          task_id: id,
          start_time: new Date(),
          is_rework: currentTask.status === 'REWORK',
        });
      } catch (timerErr) {
        console.error('Auto-timer start failed:', timerErr);
      }
    }
  }

  try {
    await db
      .update(tasks)
      .set({
        ...updateFields,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, id));

    // If we just set the task to READY_FOR_ASSIGNMENT as part of a full update, also send notifications
    if (
      (requestData.status === 'READY_FOR_ASSIGNMENT' ||
        updateFields.status === 'READY_FOR_ASSIGNMENT') &&
      updateFields.team_type // should be present from full update
    ) {
      // Get all users who should receive READY_FOR_ASSIGNMENT notifications
      const assignUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            eq(users.role, 'ADMIN'),
            eq(users.role, 'PROJECT_MANAGER'),
            and(eq(users.role, 'TEAM_LEADER'), eq(users.team_type, updateFields.team_type))
          )
        );

      const notificationPromises = assignUsers.map(user =>
        db.insert(notifications).values({
          id: uuidv4(),
          user_id: user.id,
          task_id: id,
          type: 'READY_FOR_ASSIGNMENT',
          is_read: false,
          created_at: new Date(),
        })
      );
      await Promise.all(notificationPromises);
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Field update error:', err);
    return Response.json({ error: 'Failed to update task' }, { status: 500 });
  }
}