// src/app/api/projects/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { projects, tasks, users } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, inArray, and } from 'drizzle-orm'; // ← added 'and'

// GET projects (role-aware)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let allProjects: typeof projects.$inferSelect[] = [];

    if (session.user.role === 'ADMIN' || session.user.role === 'PROJECT_MANAGER') {
      // Admin & PM see ALL projects
      allProjects = await db.select().from(projects);
    } else if (session.user.role === 'TEAM_LEADER') {
      // Team Leader sees ONLY projects with tasks assigned to their team
      // Fetch team members where:
      // - team_leader_id = current user ID
      // - team_type = current user's team_type
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.team_leader_id, session.user.id),
            eq(users.team_type, session.user.team_type) // ← critical fix
          )
        );

      if (teamMembers.length === 0) {
        allProjects = [];
      } else {
        const teamMemberIds = teamMembers.map(u => u.id);
        const teamTasks = await db
          .select({ project_id: tasks.project_id })
          .from(tasks)
          .where(inArray(tasks.assigned_to, teamMemberIds));

        const projectIds = [...new Set(teamTasks.map(t => t.project_id))];
        allProjects = projectIds.length > 0
          ? await db.select().from(projects).where(inArray(projects.id, projectIds))
          : [];
      }
    } else {
      // Developer/Designer/QA: only projects with their tasks
      const myTasks = await db
        .select({ project_id: tasks.project_id })
        .from(tasks)
        .where(eq(tasks.assigned_to, session.user.id));

      const projectIds = [...new Set(myTasks.map(t => t.project_id))];
      allProjects = projectIds.length > 0
        ? await db.select().from(projects).where(inArray(projects.id, projectIds))
        : [];
    }

    return Response.json({ projects: allProjects });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST create new project
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'PROJECT_MANAGER') {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { name, client_name, website_url, fiverr_order_id } = await req.json(); // ← fixed typo

  if (!name) {
    return Response.json({ error: 'Project name is required' }, { status: 400 });
  }

  try {
    await db.insert(projects).values({
      id: uuidv4(),
      name,
      client_name: client_name || null,
      website_url: website_url || null,
      fiverr_order_id: fiverr_order_id || null, // ← fixed typo
      status: 'CLIENT',
      created_by: session.user.id,
      created_at: new Date(),
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects error:', err);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}