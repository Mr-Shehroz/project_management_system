// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import NotificationsBell from './notifications-bell';
import { db } from '@/db';
import { projects, tasks, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import SidebarClient, { LogoutButton } from './sidebar-client';

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
    userProjects = (await db.select().from(projects)) as Project[];
  } else if (session.user.role === 'TEAM_LEADER') {
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
    userProjects = [];
  } else {
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Sidebar — manages its own collapse and writes --sidebar-width to <html> */}
      <SidebarClient
        userRole={session.user.role}
        userProjects={userProjects}
        userName={session.user.name || ''}
      />

      {/* Main content — margin-left is driven by SidebarClient via DOM id */}
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ marginLeft: '256px', transition: 'margin-left 300ms cubic-bezier(.4,0,.2,1)' }}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div />
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <LogoutButton />
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}