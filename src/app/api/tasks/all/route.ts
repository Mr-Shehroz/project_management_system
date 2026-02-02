// src/app/api/tasks/all/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, projects, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // Only allow Admin, PM, Team Leader
  const allowedRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'];
  if (!session || !allowedRoles.includes(session.user.role)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        created_at: tasks.created_at,
        project_name: projects.name,
        assigned_to_name: users.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.project_id, projects.id))
      .innerJoin(users, eq(tasks.assigned_to, users.id))
      .orderBy(tasks.created_at);

    return Response.json({ tasks: allTasks });
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}