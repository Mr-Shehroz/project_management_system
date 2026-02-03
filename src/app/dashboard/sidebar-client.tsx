// src/app/dashboard/sidebar-client.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu, X, FolderPlus, Users, LayoutDashboard, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import CreateProjectModal from './create-project-modal';
import EditProjectModal from './edit-project-modal';

type Project = {
  id: string;
  name: string;
  client_name?: string;
  website_url?: string;
  fiverr_order_id?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const EXPANDED_WIDTH = 256;   // px — matches Tailwind w-64
const COLLAPSED_WIDTH = 72;   // px — icon-only rail

export default function SidebarClient({
  userRole,
  userProjects,
  userName,
}: {
  userRole: string;
  userProjects: Project[];
  userName: string;
}) {
  // ── mobile open/close ──
  const [isOpen, setIsOpen] = useState(false);
  // ── desktop collapsed / expanded ──
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ── original state (untouched) ──
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState<Project | null>(null);
  const [qaProjects, setQaProjects] = useState<Project[]>([]);
  const [loadingQaProjects, setLoadingQaProjects] = useState(false);
  const [localProjects, setLocalProjects] = useState<Project[]>(userProjects);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentProjectId = searchParams.get('project');

  // ── sync main-content margin whenever collapsed state changes ──
  useEffect(() => {
    const width = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    const main = document.getElementById('main-content');
    if (main) {
      main.style.transition = 'margin-left 300ms cubic-bezier(.4,0,.2,1)';
      main.style.marginLeft = window.innerWidth >= 1024 ? `${width}px` : '0px';
    }
  }, [isCollapsed]);

  // ── on resize, keep margin in sync (desktop <-> mobile) ──
  useEffect(() => {
    const syncMargin = () => {
      const main = document.getElementById('main-content');
      if (!main) return;
      if (window.innerWidth < 1024) {
        main.style.marginLeft = '0px';
      } else {
        main.style.marginLeft = `${isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`;
      }
    };
    syncMargin(); // initial paint
    window.addEventListener('resize', syncMargin);
    return () => window.removeEventListener('resize', syncMargin);
  }, [isCollapsed]);

  // ── on mobile resize back above breakpoint, close overlay ──
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setIsOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  //  ORIGINAL LOGIC — completely untouched below this line
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    setLocalProjects(userProjects);
  }, [userProjects]);

  const handleProjectClick = (projectId: string) => {
    const params = new URLSearchParams();
    params.set('project', projectId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const projectsToShow = userRole === 'QA' ? qaProjects : localProjects;

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

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  }, [pathname]);

  const fetchProjectsForRole = useCallback(async () => {
    if (userRole === 'QA') {
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

  useEffect(() => {
    if (userRole === 'QA') {
      fetchProjectsForRole();
    }
  }, [userRole, fetchProjectsForRole]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchProjectsForRole();
    };
    window.addEventListener('refresh-tasks', handleRefresh);
    return () => window.removeEventListener('refresh-tasks', handleRefresh);
  }, [fetchProjectsForRole]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // Effective width for the sidebar panel itself
  const panelWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <>
      {/* ─── Mobile hamburger ─────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 menu-button w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 shadow-md hover:shadow-lg transition-all"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ─── Mobile overlay ───────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Sidebar panel ────────────────────────────────────────────── */}
      <aside
        className={`
          sidebar-container group/sidebar
          fixed lg:fixed
          inset-y-0 left-0 z-40
          bg-white dark:bg-gray-900
          shadow-xl
          flex flex-col
          border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ width: `${panelWidth}px` }}
      >
        {/* ── Desktop collapse/expand toggle ─ straddles the right border ── */}
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className={`
            hidden lg:flex
            absolute top-5 -right-3 z-50
            w-6 h-6 rounded-full
            items-center justify-center
            bg-white dark:bg-gray-900
            border border-gray-300 dark:border-gray-600
            text-gray-500 dark:text-gray-400
            hover:text-blue-600 dark:hover:text-blue-400
            hover:border-blue-400 dark:hover:border-blue-500
            shadow-md
            transition-all duration-200
            ${isCollapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}
          `}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* ── Header / brand ──────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          {/* gradient background */}
          <div className="absolute inset-0 bg-gradient-135 from-blue-600 via-indigo-600 to-purple-600" />
          {/* subtle noise texture overlay for depth */}
          <div className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
          {/* content */}
          <div className={`relative z-10 p-4 flex flex-col gap-3 ${isCollapsed ? 'items-center' : ''}`}>
            {/* Logo row */}
            <Link href="/dashboard" className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <h1 className="text-lg font-bold text-white tracking-tight">ProjectFlow</h1>
              )}
            </Link>

            {/* User info */}
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                {/* avatar ring */}
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{userName.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{userName}</p>
                  <span className="text-xs text-blue-200">{userRole}</span>
                </div>
              </div>
            )}

            {isCollapsed && (
              <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{userName.charAt(0)}</span>
              </div>
            )}
          </div>

        </div>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">

          {/* Admin: Add User link */}
          {userRole === 'ADMIN' && (
            <Link
              href="/admin/register"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white
                transition-colors duration-150 group
                ${isCollapsed ? 'justify-center' : ''}
              `}
              onClick={() => window.innerWidth < 1024 && setIsOpen(false)}
              title={isCollapsed ? 'Add User' : undefined}
            >
              <Users className="w-4.5 h-4.5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">Add User</span>}
            </Link>
          )}

          {/* Create Project button */}
          {(userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') && (
            <button
              onClick={() => {
                setShowCreateProjectModal(true);
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`
                mt-2 w-full flex items-center gap-2 px-3 py-2.5
                bg-gradient-to-r from-emerald-500 to-green-500
                hover:from-emerald-600 hover:to-green-600
                text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg
                transition-all duration-200
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
              title={isCollapsed ? 'Create Project' : undefined}
            >
              <FolderPlus className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Create Project</span>}
            </button>
          )}

          {/* ── Projects list ───────────────────────────────────────────── */}
          <div className="mt-5">
            {!isCollapsed && (
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-3">
                Projects
              </h2>
            )}
            {isCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-800 mx-3 mb-2" />}

            <ul className="space-y-0.5">
              {loadingQaProjects && userRole === 'QA' ? (
                <li className={`px-3 py-2 text-gray-400 dark:text-gray-500 text-xs ${isCollapsed ? 'text-center' : ''}`}>
                  {isCollapsed ? '…' : 'Loading…'}
                </li>
              ) : projectsToShow.length > 0 ? (
                projectsToShow.map((project) => {
                  const isActive = currentProjectId === project.id;
                  return (
                    <li key={project.id} className="flex items-center group">
                      <button
                        onClick={() => {
                          handleProjectClick(project.id);
                          if (window.innerWidth < 1024) setIsOpen(false);
                        }}
                        title={isCollapsed ? project.name : undefined}
                        className={`
                          flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm
                          transition-all duration-150
                          ${isActive
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200/40 dark:shadow-blue-900/30'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          }
                          ${isCollapsed ? 'justify-center' : ''}
                        `}
                      >
                        {/* project initial circle */}
                        <span className={`
                          flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold
                          ${isActive ? 'bg-white/25 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}
                        `}>
                          {project.name.charAt(0)}
                        </span>
                        {!isCollapsed && (
                          <span className="truncate font-medium">{project.name}</span>
                        )}
                      </button>

                      {/* Edit icon — Admin / PM only */}
                      {(userRole === 'ADMIN' || userRole === 'PROJECT_MANAGER') && !isCollapsed && (
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
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="Edit project"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </li>
                  );
                })
              ) : (
                <li className={`px-3 py-2 text-gray-400 dark:text-gray-500 text-xs italic ${isCollapsed ? 'text-center' : ''}`}>
                  {isCollapsed ? '—' : 'No projects'}
                </li>
              )}
            </ul>
          </div>
        </nav>


      </aside>

      {/* ─── Modals (original, untouched) ─────────────────────────────── */}
      {showCreateProjectModal && (
        <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
      )}

      {showEditProjectModal && (
        <EditProjectModal
          project={showEditProjectModal}
          onClose={() => setShowEditProjectModal(null)}
          onUpdated={() => {
            fetchProjectsForRole();
            setShowEditProjectModal(null);
          }}
        />
      )}
    </>
  );
}

// ─── Named export: LogoutButton (used by layout.tsx) ────────────────────────
export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="group flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
      title="Sign out"
    >
      <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}