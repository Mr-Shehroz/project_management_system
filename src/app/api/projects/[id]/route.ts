// src/app/api/projects/[id]/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (project.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse files JSON if exists
    const projectWithFiles = {
      ...project[0],
      files: project[0].files ? JSON.parse(project[0].files) : [],
    };

    return Response.json({ project: projectWithFiles });
  } catch (err) {
    console.error('GET /api/projects/[id] error:', err);
    return Response.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and project managers can update projects
  if (session.user.role !== 'ADMIN' && session.user.role !== 'PROJECT_MANAGER') {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, client_name, website_url, status, files } = body;

    // Validate required fields
    if (!name) {
      return Response.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Prepare files JSON
    const filesJson = Array.isArray(files) && files.length > 0
      ? JSON.stringify(files)
      : null;

    // Update project
    await db
      .update(projects)
      .set({
        name: name.trim(),
        client_name: client_name?.trim() || null,
        website_url: website_url?.trim() || null,
        status: status || 'CLIENT',
        files: filesJson,
        updated_at: new Date(),
      })
      .where(eq(projects.id, id));

    return Response.json({ success: true });
  } catch (err) {
    console.error('PUT /api/projects/[id] error:', err);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin can delete projects
  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Only admins can delete projects' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    await db.delete(projects).where(eq(projects.id, id));
    return Response.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id] error:', err);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}