// src/app/api/tasks/[id]/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status } = await request.json();
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_QA', 'APPROVED', 'REWORK'];

  if (!validStatuses.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    await db
      .update(tasks)
      .set({ status, updated_at: new Date() })
      .where(eq(tasks.id, params.id));

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to update task' }, { status: 500 });
  }
}