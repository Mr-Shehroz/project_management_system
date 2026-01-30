// src/app/dashboard/sidebar-client.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu, X, FolderPlus, Users, LayoutDashboard } from 'lucide-react';
import CreateProjectModal from './create-project-modal';
import EditProjectModal from './edit-project-modal';

type Project = {
  id: string;
  name: string;
  client_name?: string;
  website_url?: string;
  fiverr_order_id?: string;
};

export default function SidebarClient({
  userRole,
  userProjects,
  userName,
}: {
  userRole: string;
  userProjects: Project[];
  userName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState<Project | null>(null);
  const [qaProjects, setQaProjects] = useState<Project[]>([]);
  const [loadingQaProjects, setLoadingQaProjects] = useState(false);
  // Local state for projects that can be updated in real-time
  const [localProjects, setLocalProjects] = useState<Project[]>(userProjects);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Get current project ID from URL
  const currentProjectId = searchParams.get('project');

  // Sync localProjects with userProjects prop when it changes
  useEffect(() => {
    setLocalProjects(userProjects);
  }, [userProjects]);

  // Handle project click
  const handleProjectClick = (projectId: string) => {
    const params = new URLSearchParams();
    params.set('project', projectId);
    router.push(`${pathname}?${params.toString()}`);
  };


  // Determine which projects to show
  const projectsToShow = userRole === 'QA' ? qaProjects : localProjects;

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && window.innerWidth < 1024) {
        const target = e.target as HTMLElement;
        if (!target.closest('.sidebar-container') && !target.closest('.menu-button')) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  }, [pathname]);

  // Fetch projects based on user role
  const fetchProjectsForRole = useCallback(async () => {
    if (userRole === 'QA') {
      // QA: Fetch projects from tasks
      setLoadingQaProjects(true);
      try {
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const projectIds = [...new Set((tasksData.tasks || []).map((t: any) => t.project_id))];
          if (projectIds.length > 0) {
            const projectsRes = await fetch('/api/projects');
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              const filteredProjects = (projectsData.projects || [])
                .filter((p: any) => projectIds.includes(p.id))
                .map((p: any) => ({ 
                  id: p.id, 
                  name: p.name,
                  client_name: p.client_name,
                  website_url: p.website_url,
                  fiverr_order_id: p.fiverr_order_id
                }));
              setQaProjects(filteredProjects);
            }
          } else {
            setQaProjects([]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch QA projects:', err);
        setQaProjects([]);
      } finally {
        setLoadingQaProjects(false);
      }
    } else if (userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') {
      // Admin & PM: Fetch all projects
      try {
        const projectsRes = await fetch('/api/projects');
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const allProjects = (projectsData.projects || []).map((p: any) => ({ 
            id: p.id, 
            name: p.name,
            client_name: p.client_name,
            website_url: p.website_url,
            fiverr_order_id: p.fiverr_order_id
          }));
          setLocalProjects(allProjects);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    } else if (userRole === 'TEAM_LEADER') {
      // Team Leader: Fetch projects with tasks assigned to their team
      try {
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const projectIds = [...new Set((tasksData.tasks || []).map((t: any) => t.project_id))];
          if (projectIds.length > 0) {
            const projectsRes = await fetch('/api/projects');
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              const filteredProjects = (projectsData.projects || [])
                .filter((p: any) => projectIds.includes(p.id))
                .map((p: any) => ({ 
                  id: p.id, 
                  name: p.name,
                  client_name: p.client_name,
                  website_url: p.website_url,
                  fiverr_order_id: p.fiverr_order_id
                }));
              setLocalProjects(filteredProjects);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch team leader projects:', err);
      }
    } else {
      // Developer/Designer: Fetch projects with their tasks
      try {
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const projectIds = [...new Set((tasksData.tasks || []).map((t: any) => t.project_id))];
          if (projectIds.length > 0) {
            const projectsRes = await fetch('/api/projects');
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              const filteredProjects = (projectsData.projects || [])
                .filter((p: any) => projectIds.includes(p.id))
                .map((p: any) => ({ 
                  id: p.id, 
                  name: p.name,
                  client_name: p.client_name,
                  website_url: p.website_url,
                  fiverr_order_id: p.fiverr_order_id
                }));
              setLocalProjects(filteredProjects);
            }
          } else {
            setLocalProjects([]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch developer projects:', err);
      }
    }
  }, [userRole]);

  // Initial fetch for QA projects
  useEffect(() => {
    if (userRole === 'QA') {
      fetchProjectsForRole();
    }
  }, [userRole, fetchProjectsForRole]);

  // Listen for refresh-tasks to update projects for ALL roles
  useEffect(() => {
    const handleRefresh = () => {
      fetchProjectsForRole();
    };

    window.addEventListener('refresh-tasks', handleRefresh);
    return () => window.removeEventListener('refresh-tasks', handleRefresh);
  }, [fetchProjectsForRole]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 menu-button p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-container fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-700 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <Link href="/dashboard" className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">ProjectFlow</h1>
          </Link>
          <p className="text-sm text-blue-100 mb-2">{userName}</p>
          <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-white/20 backdrop-blur-sm rounded">
            {userRole}
          </span>
        </div>

        {/* Navigation */}
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {userRole === 'ADMIN' && (
              <li>
                <Link
                  href="/admin/register"
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  onClick={() => window.innerWidth < 1024 && setIsOpen(false)}
                >
                  <Users className="w-4 h-4" />
                  Add User
                </Link>
              </li>
            )}
          </ul>

          {/* Create Project Button */}
          {(userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') && (
            <button
              onClick={() => {
                setShowCreateProjectModal(true);
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg hover:shadow-xl"
            >
              <FolderPlus className="w-4 h-4" />
              Create Project
            </button>
          )}

          {/* Projects List */}
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">Projects</h2>
            <ul className="space-y-1">
              {loadingQaProjects && userRole === 'QA' ? (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
                  Loading projects...
                </li>
              ) : projectsToShow.length > 0 ? (
                projectsToShow.map((project) => (
                  <li key={project.id} className="flex items-center justify-between group">
                    <button
                      onClick={() => {
                        handleProjectClick(project.id);
                        if (window.innerWidth < 1024) setIsOpen(false);
                      }}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        currentProjectId === project.id
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {project.name}
                    </button>
                    
                    {/* Edit Icon - Only for Admin/PM */}
                    {(userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetch(`/api/projects/${project.id}`)
                            .then(res => res.json())
                            .then(data => {
                              setShowEditProjectModal(data.project);
                            })
                            .catch(err => {
                              console.error('Failed to fetch project:', err);
                            });
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
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
      </aside>

      {showCreateProjectModal && (
        <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <EditProjectModal
          project={showEditProjectModal}
          onClose={() => setShowEditProjectModal(null)}
          onUpdated={() => {
            // Refresh projects for all roles
            fetchProjectsForRole();
            setShowEditProjectModal(null);
          }}
        />
      )}
    </>
  );
}