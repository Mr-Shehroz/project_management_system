// src/app/api/tasks/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users, notifications } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, or, inArray } from 'drizzle-orm';

// GET tasks for current user (role-aware + project-filtered)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get project ID from query params
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project');

  try {
    let userTasks;

    if (session.user.role === 'ADMIN' || session.user.role === 'PROJECT_MANAGER') {
      // Admin & PM: get all tasks (or filtered by project)
      userTasks = await db
        .select()
        .from(tasks)
        .where(projectId ? eq(tasks.project_id, projectId) : undefined);
    } else if (session.user.role === 'TEAM_LEADER') {
      // Team Leader: get team's tasks (or filtered by project)
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.team_leader_id, session.user.id),
            eq(users.team_type, session.user.team_type)
          )
        );

      const teamMemberIds = teamMembers.map(u => u.id);
      const whereCondition = projectId
        ? and(
          eq(tasks.project_id, projectId),
          or(
            inArray(tasks.assigned_to, teamMemberIds),
            eq(tasks.assigned_by, session.user.id)
          )
        )
        : or(
          inArray(tasks.assigned_to, teamMemberIds),
          eq(tasks.assigned_by, session.user.id)
        );

      userTasks = await db.select().from(tasks).where(whereCondition);
    } else if (session.user.role === 'QA') {
      // QA: only WAITING_FOR_QA tasks (or filtered by project)
      const whereCondition = projectId
        ? and(
          eq(tasks.project_id, projectId),
          eq(tasks.qa_assigned_to, session.user.id),
          eq(tasks.status, 'WAITING_FOR_QA')
        )
        : and(
          eq(tasks.qa_assigned_to, session.user.id),
          eq(tasks.status, 'WAITING_FOR_QA')
        );

      userTasks = await db.select().from(tasks).where(whereCondition);
    } else {
      // Developer/Designer: only their tasks (or filtered by project)
      const whereCondition = projectId
        ? and(eq(tasks.project_id, projectId), eq(tasks.assigned_to, session.user.id))
        : eq(tasks.assigned_to, session.user.id);

      userTasks = await db.select().from(tasks).where(whereCondition);
    }

    // Parse files JSON if exists
    const tasksWithFiles = userTasks.map(task => ({
      ...task,
      files: task.files ? JSON.parse(task.files) : [],
    }));

    return Response.json({ tasks: tasksWithFiles });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST create new task
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'];
  if (!allowedRoles.includes(session.user.role)) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const {
    project_id,
    team_type,
    title,
    description,
    priority,
    assigned_to,
    qa_assigned_to,
    estimated_minutes,
    files, // Should be an array of file URLs/objects from frontend already uploaded
  } = await req.json();

  if (!project_id || !team_type || !title || !assigned_to) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate assignment rules by role
  if (session.user.role === 'TEAM_LEADER') {
    const teamMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.team_leader_id, session.user.id),
          eq(users.team_type, team_type)
        )
      );

    const teamMemberIds = teamMembers.map(u => u.id);
    if (!teamMemberIds.includes(assigned_to)) {
      return Response.json({ error: 'You can only assign tasks to your team members' }, { status: 403 });
    }
  } else {
    const assignee = await db
      .select()
      .from(users)
      .where(and(eq(users.id, assigned_to), eq(users.team_type, team_type)))
      .limit(1);

    if (assignee.length === 0) {
      return Response.json({ error: 'Invalid assignee or team mismatch' }, { status: 400 });
    }
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
    const taskId = uuidv4();

    // files should be an array of file URLs (strings)
    // Defensive: ensure files is an array of strings
    const filesToSave =
      Array.isArray(files) && files.length > 0
        ? files.map((f) =>
            typeof f === 'string'
              ? f
              : f?.url // In case of array of objects {url, ...}
                ? f.url
                : null
          ).filter(Boolean)
        : [];

    const filesJson = JSON.stringify(filesToSave);

    await db.insert(tasks).values({
      id: taskId,
      project_id,
      team_type,
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      assigned_by: session.user.id,
      assigned_to,
      qa_assigned_to: qaUserId,
      estimated_minutes: estimated_minutes ? parseInt(estimated_minutes, 10) : null,
      files: filesJson, // ← Store files JSON array
      status: 'PENDING',
      created_at: new Date(),
    });

    // 🔔 Notify assignee
    await db.insert(notifications).values({
      id: uuidv4(),
      user_id: assigned_to,
      task_id: taskId,
      type: 'TASK_ASSIGNED',
      is_read: false,
      created_at: new Date(),
    });

    return Response.json({ success: true, taskId }, { status: 201 });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    return Response.json({ error: 'Failed to create task' }, { status: 500 });
  }
}