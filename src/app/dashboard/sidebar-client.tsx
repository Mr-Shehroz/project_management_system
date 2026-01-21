// src/app/dashboard/sidebar-client.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CreateProjectModal from './create-project-modal';

type Project = {
  id: string;
  name: string;
};

export default function SidebarClient({
  userRole,
  userProjects,
}: {
  userRole: string;
  userProjects: Project[];
}) {
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Get current project ID from URL
  const currentProjectId = searchParams.get('project');

  // Handle project click
  const handleProjectClick = (projectId: string) => {
    const params = new URLSearchParams();
    params.set('project', projectId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <nav className="p-4 flex-1">
        <ul className="space-y-1">
          {userRole === 'ADMIN' && (
            <li>
              <Link
                href="/admin/register"
                className="block w-full px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Add User
              </Link>
            </li>
          )}
        </ul>

        {/* Create Project Button */}
        {(userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') && (
          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="mt-4 w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            + Create Project
          </button>
        )}

        {/* Projects List */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Projects</h2>
          <ul className="space-y-1">
            {userProjects.length > 0 ? (
              userProjects.map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => handleProjectClick(project.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      currentProjectId === project.id
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {project.name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
                No projects
              </li>
            )}
          </ul>
        </div>
      </nav>

      {showCreateProjectModal && (
        <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
      )}
    </>
  );
}