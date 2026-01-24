// src/app/api/tasks/[id]/detail/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users as usersTable, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Await params in Next.js 15+
  const { id } = await params;

  try {
    // Create aliases using the alias() function (MySQL version)
    const usersAssignedTo = alias(usersTable, 'users_assigned_to');
    const usersAssignedBy = alias(usersTable, 'users_assigned_by');

    const taskDetail = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        assigned_to_id: tasks.assigned_to,
        assigned_to_name: usersAssignedTo.name,
        assigned_by_name: usersAssignedBy.name,
        project_name: projects.name,
        created_at: tasks.created_at,
        files: tasks.files,
        qa_assigned_to: tasks.qa_assigned_to, // ← Add this
      })
      .from(tasks)
      .innerJoin(usersAssignedTo, eq(tasks.assigned_to, usersAssignedTo.id))
      .innerJoin(usersAssignedBy, eq(tasks.assigned_by, usersAssignedBy.id))
      .innerJoin(projects, eq(tasks.project_id, projects.id))
      .where(eq(tasks.id, id))
      .limit(1);

    if (taskDetail.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDetail[0];

    // ✅ Updated visibility rules:
    const isVisible =
      // Admin/PM can see all tasks
      session.user.role === 'ADMIN' ||
      session.user.role === 'PROJECT_MANAGER' ||
      
      // Team Leader can see team tasks
      (session.user.role === 'TEAM_LEADER' &&
        (session.user.id === task.assigned_by_name || 
         true)) ||
      
      // Developer can see their own tasks
      session.user.id === task.assigned_to_id ||
      
      // ✅ QA can see WAITING_FOR_QA, APPROVED, REWORK tasks they reviewed
      (session.user.role === 'QA' && 
       (task.status === 'WAITING_FOR_QA' || 
        task.status === 'APPROVED' || 
        task.status === 'REWORK') && 
       session.user.id === task.qa_assigned_to);

    if (!isVisible) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse files JSON if exists
    const taskWithFiles = {
      ...task,
      files: task.files ? JSON.parse(task.files) : [],
    };

    return Response.json({ task: taskWithFiles });
  } catch (err) {
    console.error('Task detail error:', err);
    return Response.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}