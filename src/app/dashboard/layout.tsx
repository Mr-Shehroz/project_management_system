// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import NotificationsBell from './notifications-bell';
import { db } from '@/db';
import { projects, tasks, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import SidebarClient from './sidebar-client';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  let userProjects: Project[] = [];

  if (session.user.role === 'ADMIN' || session.user.role === 'PROJECT_MANAGER') {
    // Admin & PM see all projects
    userProjects = (await db.select().from(projects)) as Project[];
  } else if (session.user.role === 'TEAM_LEADER') {
    // Team Leader sees projects with tasks assigned to their team
    const teamMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.team_leader_id, session.user.id));

    if (teamMembers.length > 0) {
      const teamMemberIds = teamMembers.map(u => u.id);
      const teamTasks = await db
        .select({ project_id: tasks.project_id })
        .from(tasks)
        .where(inArray(tasks.assigned_to, teamMemberIds));

      const projectIds = [...new Set(teamTasks.map(t => t.project_id))];
      if (projectIds.length > 0) {
        userProjects = (await db
          .select()
          .from(projects)
          .where(inArray(projects.id, projectIds))) as Project[];
      }
    }
  } else if (session.user.role === 'QA') {
    // QA: don't pass projects here - let sidebar fetch them
    userProjects = [];
  } else {
    // Developer/Designer: only projects with their tasks
    const myTasks = await db
      .select({ project_id: tasks.project_id })
      .from(tasks)
      .where(eq(tasks.assigned_to, session.user.id));

    const projectIds = [...new Set(myTasks.map(t => t.project_id))];
    if (projectIds.length > 0) {
      userProjects = (await db
        .select()
        .from(projects)
        .where(inArray(projects.id, projectIds))) as Project[];
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Sidebar */}
      <SidebarClient
        userRole={session.user.role}
        userProjects={userProjects}
        userName={session.user.name || ''}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 p-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex justify-end shadow-sm">
          <NotificationsBell />
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}