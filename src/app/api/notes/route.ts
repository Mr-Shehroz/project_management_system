// src/app/api/notes/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskNotes } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';

// POST /api/notes → add note to task
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { task_id, note, note_type = 'COMMENT' } = body;

  if (!task_id || typeof task_id !== 'string' || !note || typeof note !== 'string') {
    return Response.json({ error: 'Task ID and note are required' }, { status: 400 });
  }

  const validNoteTypes = ['COMMENT', 'APPROVAL', 'REJECTION'];
  if (!validNoteTypes.includes(note_type)) {
    return Response.json({ error: 'Invalid note type' }, { status: 400 });
  }

  try {
    await db.insert(taskNotes).values({
      id: uuidv4(),
      task_id,
      user_id: session.user.id,
      note,
      note_type,
      created_at: new Date(),
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to save note' }, { status: 500 });
  }
}

// GET /api/notes?task_id=... → get all notes for a task
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('task_id');

  if (!taskId) {
    return Response.json({ error: 'Task ID is required' }, { status: 400 });
  }

  try {
    const notes = await db
      .select()
      .from(taskNotes)
      .where(eq(taskNotes.task_id, taskId))
      .orderBy(desc(taskNotes.created_at));

    return Response.json({ notes });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}