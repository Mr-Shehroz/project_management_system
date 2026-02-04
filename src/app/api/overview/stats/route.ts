// src/app/api/overview/stats/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // Only allow authorized roles
  if (!session || !['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get time filter from query params (default: 30 days)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Get all team members (developers, designers, QA)
    const teamMembers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        team_type: users.team_type,
      })
      .from(users)
      .where(
        and(
          sql`${users.role} IN ('DEVELOPER', 'DESIGNER', 'QA')`,
          eq(users.is_active, true)
        )
      );

    // Get TOTAL rework counts per user (lifetime)
    const reworkStats = await db
      .select({
        assigned_to: tasks.assigned_to,
        total_rework_count: sql<number>`SUM(${tasks.rework_count})`.mapWith(Number),
      })
      .from(tasks)
      .where(
        and(
          sql`${tasks.assigned_to} IS NOT NULL`,
          sql`${tasks.rework_count} > 0`
        )
      )
      .groupBy(tasks.assigned_to);

    // For filtered, we just use the same data as total for now.
    const filteredReworkStats = reworkStats;

    // Create maps for quick lookup
    const totalReworkMap = new Map<string, number>();
    reworkStats.forEach(stat => {
      totalReworkMap.set(stat.assigned_to, stat.total_rework_count);
    });

    const filteredReworkMap = new Map<string, number>();
    filteredReworkStats.forEach(stat => {
      filteredReworkMap.set(stat.assigned_to, stat.total_rework_count);
    });

    // Combine data
    const userStats = teamMembers.map(user => ({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      team_type: user.team_type || 'N/A',
      total_rework_count: totalReworkMap.get(user.id) || 0,
      filtered_rework_count: filteredReworkMap.get(user.id) || 0,
    }));

    // Sort by total rework count (descending)
    userStats.sort((a, b) => b.total_rework_count - a.total_rework_count);

    return Response.json({ 
      success: true, 
      userStats,
      filter: {
        days,
        from: dateThreshold.toISOString(),
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch overview stats:', error);
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}