// src/app/api/projects/[id]/tasks/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Await params
  const { id } = await params;

  try {
    let projectTasks;

    if (session.user.role === 'TEAM_LEADER') {
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

      projectTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, id),
            or(
              inArray(tasks.assigned_to, teamMemberIds),
              eq(tasks.assigned_by, session.user.id)
            )
          )
        );
    } else {
      // All other users: get their own tasks for this project
      projectTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, id),
            eq(tasks.assigned_to, session.user.id)
          )
        );
    }

    return Response.json({ tasks: projectTasks });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}