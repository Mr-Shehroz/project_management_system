// src/app/api/projects/[id]/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id))
      .limit(1);

    if (project.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Enforce visibility (reuse same logic as /api/projects)
    // ... (add role-based check here if needed)

    return Response.json({ project: project[0] });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}