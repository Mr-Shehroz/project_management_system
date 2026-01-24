// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import NotificationsBell from './notifications-bell';
import { db } from '@/db';
import { projects, tasks, users } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm'; // <-- Fix: add and
import SidebarClient from './sidebar-client'; // ← new import
import Link from 'next/link';

// TypeScript: define Project type according to sidebar-client.tsx
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
    // ✅ QA: don't pass projects here - let sidebar fetch them
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/dashboard" className="text-xl font-bold text-gray-800 dark:text-white">ProjectFlow</Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{session.user.name}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded">
            {session.user.role}
          </span>
        </div>

        {/* Client-side sidebar content */}
        <SidebarClient
          userRole={session.user.role}
          userProjects={userProjects}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-end">
          <NotificationsBell />
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}