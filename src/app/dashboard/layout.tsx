// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import Link from 'next/link';
import NotificationsBell from './notifications-bell'; // ← new import

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    ...(session.user.role === 'ADMIN'
      ? [{ name: 'Admin', href: '/admin/register' }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">ProjectFlow</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{session.user.name}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded">
            {session.user.role}
          </span>
        </div>
        <nav className="p-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block w-full px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-end">
          <NotificationsBell />
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}