// src/app/api/tasks/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users, notifications } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, inArray, or } from 'drizzle-orm'; // <-- Added 'or'

// GET tasks (role-aware)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let userTasks;

    if (session.user.role === 'ADMIN' || session.user.role === 'PROJECT_MANAGER') {
      // Admin & PM see ALL tasks
      userTasks = await db.select().from(tasks);
    } else if (session.user.role === 'TEAM_LEADER') {
      // Team Leader sees:
      // - Tasks assigned to their team members
      // - Tasks they created
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.team_leader_id, session.user.id));

      const teamMemberIds = teamMembers.map(u => u.id);
      userTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.team_type, session.user.team_type),
            // Use 'or' from drizzle-orm
            or(
              inArray(tasks.assigned_to, teamMemberIds),
              eq(tasks.assigned_by, session.user.id)
            )
          )
        );
    } else if (session.user.role === 'QA') {
      // QA sees tasks where they are qa_assigned_to AND status is WAITING_FOR_QA
      userTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.qa_assigned_to, session.user.id),
            eq(tasks.status, 'WAITING_FOR_QA')
          )
        );
    } else {
      // Developer/Designer: only their own tasks
      userTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.assigned_to, session.user.id));
    }

    return Response.json({ tasks: userTasks });
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
  } = await req.json();

  if (!project_id || !team_type || !title || !assigned_to) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate assignment rules by role
  if (session.user.role === 'TEAM_LEADER') {
    // Team Leader can only assign to their own team members
    const teamMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.team_leader_id, session.user.id));

    const teamMemberIds = teamMembers.map(u => u.id);
    if (!teamMemberIds.includes(assigned_to)) {
      return Response.json({ error: 'You can only assign tasks to your team members' }, { status: 403 });
    }

    // Also ensure team_type matches
    const assignee = await db
      .select()
      .from(users)
      .where(and(eq(users.id, assigned_to), eq(users.team_type, team_type)))
      .limit(1);

    if (assignee.length === 0) {
      return Response.json({ error: 'Invalid assignee or team mismatch' }, { status: 400 });
    }
  } else {
    // ADMIN or PROJECT_MANAGER: can assign to anyone
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

    if (qaUser.length === 0 || qaUser[0].team_type !== 'QA') {
      return Response.json({ error: 'Invalid QA user' }, { status: 400 });
    }
    qaUserId = qaUser[0].id;
  }

  try {
    const taskId = uuidv4();

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