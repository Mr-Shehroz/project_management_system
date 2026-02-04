// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users, projects, notifications, taskTimers } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Helper for clean error response
function errorJson(message: string, status = 400, extra: any = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Defensive: correct param getting
  let id: string | undefined = undefined;
  if (context?.params) {
    const maybeParams: any = context.params;
    if (typeof maybeParams?.then === 'function') {
      // It's a promise (edge case/bug)
      try {
        const awaited = await maybeParams;
        id = awaited?.id;
      } catch (e) {}
    } else if (maybeParams?.id) {
      id = maybeParams.id;
    }
  }
  if (!id) {
    // Fallback: brute extract from url like /api/tasks/[id]
    let url = '';
    try {
      url = request.url;
      // Remove everything before /tasks/
      const m = url.match(/\/tasks\/([^/?#]+)/);
      if (m) id = m[1];
    } catch (e) { }
  }
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return errorJson('No task id provided', 400);
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return errorJson('Unauthorized', 401);
  }

  // Find the task robustly
  let currentTaskArr: any[] = [];
  try {
    currentTaskArr = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  } catch (e) {
    return errorJson('Database error', 500);
  }

  // If not found, try conversion (legacy bug fallback) and as number-string
  if (!currentTaskArr || currentTaskArr.length === 0) {
    let fallbackId: string | undefined = undefined;
    if (typeof id === "string" && id.match(/^\d+$/)) {
      fallbackId = Number(id).toString();
    }
    if (fallbackId && fallbackId !== id) {
      try {
        currentTaskArr = await db.select().from(tasks).where(eq(tasks.id, fallbackId)).limit(1);
      } catch (e) {}
    }
    if (!currentTaskArr || currentTaskArr.length === 0) {
      return errorJson('Task not found', 404, { debug_task_id: id });
    }
  }
  const currentTask = currentTaskArr[0];

  let requestData: Record<string, any>;
  try {
    requestData = await request.json();
  } catch (e) {
    return errorJson('Invalid JSON', 400);
  }

  // --- STATUS-ONLY HANDLING ---
  if (requestData.status !== undefined) {
    const oldStatus = currentTask.status;
    const newStatus = requestData.status;

    // Only QA can move to REWORK (and only if not already in REWORK)
    if (newStatus === 'REWORK' && oldStatus !== 'REWORK') {
      if (session.user.role !== 'QA') {
        return errorJson('Only QA can approve or request rework', 403);
      }
      try {
        await db
          .update(tasks)
          .set({
            status: 'REWORK',
            qa_assigned_to: null,
            qa_assigned_at: null,
            rework_count: sql`${tasks.rework_count} + 1`,
            updated_at: new Date(),
          })
          .where(eq(tasks.id, currentTask.id));

        // Notify admins/PM/leader/original assignee
        const notifyUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              eq(users.role, 'ADMIN'),
              eq(users.role, 'PROJECT_MANAGER'),
              eq(users.role, 'TEAM_LEADER'),
              eq(users.id, currentTask.assigned_to)
            )
          );
        await Promise.all(
          notifyUsers.map(dbUser =>
            db.insert(notifications).values({
              id: uuidv4(),
              user_id: dbUser.id,
              task_id: currentTask.id,
              type: 'TASK_REWORK',
              is_read: false,
              created_at: new Date(),
            })
          )
        );
        return NextResponse.json({ success: true }, { status: 200 });
      } catch (err) {
        console.error('Rework update error:', err);
        return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
      }
    }

    // Only assigned member can move from IN_PROGRESS to WAITING_FOR_QA
    if (oldStatus === 'IN_PROGRESS' && newStatus === 'WAITING_FOR_QA') {
      if (currentTask.assigned_to !== session.user.id) {
        return errorJson('Only the assigned member can submit for QA', 403);
      }
    }

    // Only QA can approve
    if (newStatus === 'APPROVED' && session.user.role !== 'QA') {
      return errorJson('Only QA can approve', 403);
    }

    // Only Admin/PM/Team Leader can move to PENDING
    if (
      newStatus === 'PENDING' &&
      !['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)
    ) {
      return errorJson('Insufficient permissions to reset task status', 403);
    }

    // REWORK -> WAITING_FOR_QA (resubmission)
    if (oldStatus === 'REWORK' && newStatus === 'WAITING_FOR_QA') {
      try {
        // Notify QA
        const qaUserId = currentTask.qa_assigned_to;
        if (qaUserId) {
          await db.insert(notifications).values({
            id: uuidv4(),
            user_id: qaUserId,
            task_id: currentTask.id,
            type: 'TASK_RESUBMITTED',
            is_read: false,
            created_at: new Date(),
          });
        }
        // Notify Admin/PM/TL
        const oversightUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              eq(users.role, 'ADMIN'),
              eq(users.role, 'PROJECT_MANAGER'),
              eq(users.role, 'TEAM_LEADER')
            )
          );
        await Promise.all(
          oversightUsers.map((user) =>
            db.insert(notifications).values({
              id: uuidv4(),
              user_id: user.id,
              task_id: currentTask.id,
              type: 'TASK_RESUBMITTED',
              is_read: false,
              created_at: new Date(),
            })
          )
        );
        await db.update(tasks)
          .set({ status: 'WAITING_FOR_QA', updated_at: new Date()})
          .where(eq(tasks.id, currentTask.id));
        return NextResponse.json({ success: true }, { status: 200 });
      } catch (err) {
        console.error('Resubmission notification error:', err);
        return errorJson('Failed to update task status', 500);
      }
    }

    // General status update with notifications
    try {
      if (newStatus !== oldStatus) {
        if (newStatus === 'APPROVED') {
          // Notify admins, PM, leader, assignee
          const notifyUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(
              or(
                eq(users.role, 'ADMIN'),
                eq(users.role, 'PROJECT_MANAGER'),
                eq(users.role, 'TEAM_LEADER'),
                eq(users.id, currentTask.assigned_to)
              )
            );
          await Promise.all(
            notifyUsers.map(user =>
              db.insert(notifications).values({
                id: uuidv4(),
                user_id: user.id,
                task_id: currentTask.id,
                type: 'TASK_APPROVED',
                is_read: false,
                created_at: new Date(),
              })
            )
          );
        } else if (newStatus === 'WAITING_FOR_QA' && oldStatus === 'IN_PROGRESS') {
          let qaUserId = currentTask.qa_assigned_to;
          if (!qaUserId) {
            const pm = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.role, 'PROJECT_MANAGER'))
              .limit(1);
            if (pm.length > 0) qaUserId = pm[0].id;
          }
          if (qaUserId) {
            await db.insert(notifications).values({
              id: uuidv4(),
              user_id: qaUserId,
              task_id: currentTask.id,
              type: 'QA_REVIEWED',
              is_read: false,
              created_at: new Date(),
            });
          }
        }
      }

      // WAITING_FOR_QA: clear QA assignment (if not REWORK branch)
      if (newStatus === 'WAITING_FOR_QA' && oldStatus !== 'REWORK') {
        await db.update(tasks)
          .set({
            status: 'WAITING_FOR_QA',
            qa_assigned_to: null,
            updated_at: new Date()
          })
          .where(eq(tasks.id, currentTask.id));
        return NextResponse.json({ success: true }, { status: 200 });
      }
      // READY_FOR_ASSIGNMENT notifs
      else if (newStatus === 'READY_FOR_ASSIGNMENT') {
        // Validate team_type
        let team_type = requestData.team_type || currentTask.team_type;
        if (!team_type) {
          return errorJson('Missing team_type for READY_FOR_ASSIGNMENT', 400);
        }
        // Notify Admin/PM/all TL for type
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
        await Promise.all(
          assignUsers.map(user =>
            db.insert(notifications).values({
              id: uuidv4(),
              user_id: user.id,
              task_id: currentTask.id,
              type: 'READY_FOR_ASSIGNMENT',
              is_read: false,
              created_at: new Date(),
            })
          )
        );
        await db.update(tasks)
          .set({
            status: 'IN_PROGRESS', // fallback, or set as allowed value, see model type union
            updated_at: new Date()
          })
          .where(eq(tasks.id, currentTask.id));
        return NextResponse.json({ success: true, note: 'READY_FOR_ASSIGNMENT is not a valid status, set to IN_PROGRESS instead' }, { status: 200 });
      }
      // General status update
      else {
        await db.update(tasks)
          .set({
            status: newStatus,
            updated_at: new Date()
          })
          .where(eq(tasks.id, currentTask.id));
        return NextResponse.json({ success: true }, { status: 200 });
      }
    } catch (err) {
      console.error('Status update error:', err);
      return errorJson('Failed to update task status', 500);
    }
  }

  // --- NON-STATUS: FULL/PARTIAL EDIT ---
  const canEditFields =
    session.user.role === 'ADMIN' ||
    session.user.role === 'PROJECT_MANAGER' ||
    session.user.role === 'TEAM_LEADER';

  if (!canEditFields) {
    return errorJson('Insufficient permissions to edit task fields', 403);
  }

  const updateFields: Record<string, any> = {};

  // "Full edit" case: all 3 must be present (not just defined)
  const isFullEdit =
    requestData.project_id !== undefined &&
    requestData.team_type !== undefined &&
    requestData.assigned_to !== undefined;

  if (isFullEdit) {
    if (
      !requestData.project_id ||
      !requestData.team_type ||
      !requestData.assigned_to
    ) {
      return errorJson('Missing required fields (project_id, team_type, assigned_to)', 400);
    }
    // Project check
    const project = await db.select().from(projects).where(eq(projects.id, requestData.project_id)).limit(1);
    if (project.length === 0) {
      return errorJson('Invalid project', 400);
    }
    // Team type
    const validTeamTypes = ['DEVELOPER', 'DESIGNER', 'PROGRAMMER'];
    if (!validTeamTypes.includes(requestData.team_type)) {
      return errorJson('Invalid team type', 400);
    }
    // Assignee must exist with the right team
    const assignee = await db
      .select()
      .from(users)
      .where(and(eq(users.id, requestData.assigned_to), eq(users.team_type, requestData.team_type)))
      .limit(1);
    if (assignee.length === 0) {
      return errorJson('Invalid assignee or team mismatch', 400);
    }
    updateFields.project_id = requestData.project_id;
    updateFields.team_type = requestData.team_type;
    updateFields.assigned_to = requestData.assigned_to;
  }

  // title
  if (Object.prototype.hasOwnProperty.call(requestData, 'title')) {
    if (typeof requestData.title !== 'string' || requestData.title.trim() === '') {
      return errorJson('Title cannot be empty', 400);
    }
    updateFields.title = requestData.title.trim();
  }
  // description
  if (Object.prototype.hasOwnProperty.call(requestData, 'description')) {
    updateFields.description =
      typeof requestData.description === 'string'
        ? (requestData.description.trim() === '' ? null : requestData.description.trim())
        : null;
  }
  // priority
  if (Object.prototype.hasOwnProperty.call(requestData, 'priority')) {
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    if (!validPriorities.includes(requestData.priority)) {
      return errorJson('Invalid priority', 400);
    }
    updateFields.priority = requestData.priority;
  }
  // QA Assigned To
  if (Object.prototype.hasOwnProperty.call(requestData, 'qa_assigned_to')) {
    if (requestData.qa_assigned_to === null) {
      updateFields.qa_assigned_to = null;
    } else {
      const qaUserArr = await db
        .select()
        .from(users)
        .where(eq(users.id, requestData.qa_assigned_to))
        .limit(1);
      if (
        qaUserArr.length === 0 ||
        qaUserArr[0].role !== 'QA'
      ) {
        return errorJson('Invalid QA user', 400);
      }
      updateFields.qa_assigned_to = requestData.qa_assigned_to;
    }
  }
  // Estimated Minutes
  if (Object.prototype.hasOwnProperty.call(requestData, 'estimated_minutes')) {
    if (
      requestData.estimated_minutes === null ||
      requestData.estimated_minutes === ""
    ) {
      updateFields.estimated_minutes = null;
    } else {
      const minutes = parseInt(requestData.estimated_minutes, 10);
      if (isNaN(minutes) || minutes < 0) {
        return errorJson('Invalid estimated minutes', 400);
      }
      updateFields.estimated_minutes = minutes;
    }
  }
  // Files
  if (Object.prototype.hasOwnProperty.call(requestData, 'files')) {
    if (!Array.isArray(requestData.files)) {
      return errorJson('Invalid files format', 400);
    }
    updateFields.files = JSON.stringify(requestData.files);
  }

  if (Object.keys(updateFields).length === 0) {
    return errorJson('No valid fields to update', 400);
  }

  // Auto-timer (assigned_to changes to non-QA user)
  if (
    Object.prototype.hasOwnProperty.call(updateFields, 'assigned_to') &&
    updateFields.assigned_to !== currentTask.assigned_to
  ) {
    try {
      const assignedUserArr = await db
        .select()
        .from(users)
        .where(eq(users.id, updateFields.assigned_to))
        .limit(1);
      if (assignedUserArr.length > 0 && assignedUserArr[0].role !== 'QA') {
        await db.insert(taskTimers).values({
          id: uuidv4(),
          task_id: currentTask.id,
          start_time: new Date(),
          is_rework: currentTask.status === 'REWORK',
        });
      }
    } catch (timerErr) {
      // log and continue
      console.error('Auto-timer start failed:', timerErr);
    }
  }

  try {
    await db
      .update(tasks)
      .set({
        ...updateFields,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, currentTask.id));

    // READY_FOR_ASSIGNMENT notifs after full edit
    if (
      (requestData.status === 'READY_FOR_ASSIGNMENT' ||
        updateFields.status === 'READY_FOR_ASSIGNMENT') &&
      (updateFields.team_type || currentTask.team_type)
    ) {
      const team_type = updateFields.team_type || currentTask.team_type;
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
      await Promise.all(
        assignUsers.map((user) =>
          db.insert(notifications).values({
            id: uuidv4(),
            user_id: user.id,
            task_id: currentTask.id,
            type: 'READY_FOR_ASSIGNMENT',
            is_read: false,
            created_at: new Date(),
          })
        )
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Field update error:', err);
    return errorJson('Failed to update task', 500);
  }
}