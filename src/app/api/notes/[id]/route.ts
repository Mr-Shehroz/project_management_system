// src/app/api/notes/[id]/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { taskNotes } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const { note, metadata } = await request.json();

  // Only QA can edit feedback notes
  if (session.user.role !== 'QA') {
    return Response.json({ error: 'Only QA can edit feedback' }, { status: 403 });
  }

  try {
    // Verify note exists and belongs to this user
    const existingNote = await db
      .select()
      .from(taskNotes)
      .where(eq(taskNotes.id, id))
      .limit(1);

    if (existingNote.length === 0) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existingNote[0].user_id !== session.user.id) {
      return Response.json({ error: 'You can only edit your own feedback' }, { status: 403 });
    }

    if (existingNote[0].note_type !== 'FEEDBACK_IMAGE') {
      return Response.json({ error: 'Can only edit feedback images' }, { status: 400 });
    }

    // Update the note
    await db
      .update(taskNotes)
      .set({
        note: note !== undefined ? note : existingNote[0].note,
        metadata: metadata !== undefined ? metadata : existingNote[0].metadata,
      })
      .where(eq(taskNotes.id, id));

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Update feedback error:', err);
    return Response.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}