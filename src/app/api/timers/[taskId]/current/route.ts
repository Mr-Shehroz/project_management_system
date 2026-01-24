// src/app/api/timers/[taskId]/current/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@/db';
import { taskTimers, tasks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;

    try {
        // Get task to check estimated time and status
        const task = await db
            .select({
                estimated_minutes: tasks.estimated_minutes,
                status: tasks.status,
                team_type: tasks.team_type
            })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);

        if (task.length === 0) {
            return Response.json({ timer: null, status: 'NO_TASK' });
        }

        // Don't show timer for APPROVED tasks
        if (task[0].status === 'APPROVED') {
            return Response.json({ timer: null, status: 'APPROVED' });
        }

        // Find ALL timers for this task
        const allTimers = await db
            .select()
            .from(taskTimers)
            .where(eq(taskTimers.task_id, taskId))
            .orderBy(taskTimers.created_at);

        // Check if timer has already been used (completed)
        const completedTimer = allTimers.find(timer => timer.end_time !== null);
        if (completedTimer) {
            const durationSeconds = completedTimer.duration_minutes ? completedTimer.duration_minutes * 60 : 0;
            const estimatedSeconds = task[0].estimated_minutes ? task[0].estimated_minutes * 60 : 0;

            if (estimatedSeconds > 0 && durationSeconds > estimatedSeconds) {
                return Response.json({
                    timer: {
                        start_time: completedTimer.start_time,
                        end_time: completedTimer.end_time,
                        duration_seconds: durationSeconds,
                        is_rework: completedTimer.is_rework
                    },
                    status: 'EXCEEDED'
                });
            } else {
                return Response.json({ timer: null, status: 'USED' });
            }
        }

        // Check if there's an active timer
        const activeTimer = allTimers.find(timer => timer.end_time === null);
        if (activeTimer) {
            const elapsedMs = Date.now() - new Date(activeTimer.start_time).getTime();
            const elapsedSeconds = Math.floor(elapsedMs / 1000);

            // Determine status based on time limit
            let status = 'RUNNING';
            if (task[0].estimated_minutes) {
                const estimatedSeconds = task[0].estimated_minutes * 60;
                if (elapsedSeconds >= estimatedSeconds) {
                    status = 'EXCEEDED';
                } else if (elapsedSeconds >= estimatedSeconds * 0.8) {
                    status = 'WARNING';
                }
            }

            return Response.json({
                timer: {
                    id: activeTimer.id,
                    start_time: activeTimer.start_time,
                    is_rework: activeTimer.is_rework,
                    elapsed_seconds: elapsedSeconds
                },
                status
            });
        }

        // No timer started yet
        return Response.json({ timer: null, status: 'AVAILABLE' });
    } catch (err) {
        console.error('Get timer error:', err);
        return Response.json({ error: 'Failed to get timer' }, { status: 500 });
    }
}