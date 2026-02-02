// src/app/api/notes/qa/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { taskNotes, tasks, users, notifications } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, or } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_id, note, status, feedback } = await request.json();

  if (!task_id || !note || !status) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Only QA can submit reviews
  if (session.user.role !== 'QA') {
    return Response.json({ error: 'Only QA can submit reviews' }, { status: 403 });
  }

  try {
    // Verify task exists
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task_id))
      .limit(1);

    if (task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Create main note (Approval/Rejection)
    await db.insert(taskNotes).values({
      id: uuidv4(),
      user_id: session.user.id,
      task_id: task_id,
      note: note,
      note_type: status === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
      created_at: new Date(),
    });

    // Save feedback items as separate notes with FEEDBACK_IMAGE type
    if (Array.isArray(feedback) && feedback.length > 0) {
      for (const item of feedback) {
        // Ensure we have the complete image URL
        let imageUrl = item.image?.url;
        
        // If URL is not complete, construct it from Cloudinary
        if (item.image && item.image.public_id && !imageUrl?.startsWith('http')) {
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
          const publicId = item.image.public_id;
          const format = item.image.format || 'jpg';
          imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.${format}`;
        }

        await db.insert(taskNotes).values({
          id: uuidv4(),
          user_id: session.user.id,
          task_id: task_id,
          note: item.note || 'Feedback image',
          note_type: 'FEEDBACK_IMAGE',
          metadata: JSON.stringify({
            image: item.image
              ? {
                  url: imageUrl, // Use the complete URL
                  public_id: item.image.public_id,
                  original_name: item.image.original_name,
                  format: item.image.format,
                  bytes: item.image.bytes,
                }
              : undefined,
          }),
          created_at: new Date(),
        });
      }
    }

    // Update task status
    await db
      .update(tasks)
      .set({
        status: status,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, task_id));

    // --------- ADD NOTIFICATION LOGIC BELOW ------------
    // Get all users who should be notified
    const notifyUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(
        or(
          eq(users.role, 'ADMIN'),
          eq(users.role, 'PROJECT_MANAGER'),
          eq(users.role, 'TEAM_LEADER'),
          eq(users.id, task[0].assigned_to)
        )
      );

    // Create notifications based on status
    const notificationType = status === 'APPROVED' ? 'TASK_APPROVED' : 'TASK_REWORK';

    const notificationPromises = notifyUsers.map(user =>
      db.insert(notifications).values({
        id: uuidv4(),
        user_id: user.id,
        task_id: task_id,
        type: notificationType,
        is_read: false,
        created_at: new Date(),
      })
    );

    await Promise.all(notificationPromises);

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('QA review error:', err);
    return Response.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}