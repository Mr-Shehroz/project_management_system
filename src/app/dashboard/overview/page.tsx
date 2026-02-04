// src/app/dashboard/overview/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

import UserEditModal from './UserEditModal';

type Project = {
  id: string;
  name: string;
  client_name?: string;
  website_url?: string;
  fiverr_order_id?: string;
  created_at: string;
};

type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  team_type?: string;
};  

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to_name: string;
  project_name: string;
  priority: string;
  created_at: string;
};

type UserReworkStat = {
  id: string;
  name: string;
  username: string;
  role: string;
  team_type: string;
  total_rework_count: number;
  filtered_rework_count: number;
};

type PriorityCounts = {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
};

const priorityColors: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  WAITING_FOR_QA: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  REWORK: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
};

// Time filter options
const TIME_FILTERS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 6 Months', days: 180 },
  { label: 'Last Year', days: 365 },
  { label: 'All Time', days: 99999 },
];

export default function OverviewDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userReworkStats, setUserReworkStats] = useState<UserReworkStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'team' | 'tasks' | 'rework'>('projects');
  const [showEditUserModal, setShowEditUserModal] = useState<User | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [reworkLoading, setReworkLoading] = useState(false);

  // SAFETY: Check permissions and redirect if not authorized
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/login');
      return;
    }

    // Only allow Admin, Project Manager, Team Leader
    const allowedRoles = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'];
    if (!allowedRoles.includes(session.user.role)) {
      router.push('/dashboard');
      return;
    }

    // If user is authorized, fetch data
    // NOTE: selectedDays is not included in dependency intentionally to avoid extra calls
    fetchOverviewData();
    fetchReworkStats(selectedDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const projectsRes = await fetch('/api/projects');
      const projectsData = projectsRes.ok ? await projectsRes.json() : { projects: [] };

      const usersRes = await fetch('/api/users/team');
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] };

      const tasksRes = await fetch('/api/tasks/all');
      const tasksData = tasksRes.ok ? await tasksRes.json() : { tasks: [] };

      setProjects(projectsData.projects || []);
      setTeamMembers(usersData.users || []);
      setTasks(tasksData.tasks || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch overview data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReworkStats = useCallback(async (days: number) => {
    setReworkLoading(true);
    try {
      const res = await fetch(`/api/overview/stats?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setUserReworkStats(data.userStats || []);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch rework stats:', err);
    } finally {
      setReworkLoading(false);
    }
  }, []);

  // Handle time filter change
  const handleTimeFilterChange = (days: number) => {
    setSelectedDays(days);
    fetchReworkStats(days);
  };

  // Get priority counts
  const getPriorityCounts = (): PriorityCounts => {
    return tasks.reduce((counts, task) => {
      if (Object.prototype.hasOwnProperty.call(counts, task.priority)) {
        counts[task.priority as keyof PriorityCounts]++;
      }
      return counts;
    }, { HIGH: 0, MEDIUM: 0, LOW: 0 });
  };

  const priorityCounts = getPriorityCounts();
  const totalReworkCount = userReworkStats.reduce((sum, user) => sum + user.total_rework_count, 0);
  const filteredReworkCount = userReworkStats.reduce((sum, user) => sum + user.filtered_rework_count, 0);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render anything if redirecting
  if (!session || !['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session.user.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Overview Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Comprehensive view of all projects, team members, and tasks
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{projects.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Projects</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{teamMembers.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Team Members</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{priorityCounts.HIGH}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">High Priority</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{priorityCounts.MEDIUM + priorityCounts.LOW}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Other Tasks</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalReworkCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Rework (All Time)</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Projects ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'team'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Team Members ({teamMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rework')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'rework'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Rework Analysis ({totalReworkCount})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{project.name}</h3>
                {project.client_name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span className="font-medium">Client:</span> {project.client_name}
                  </p>
                )}
                {project.website_url && (
                  <a
                    href={project.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mb-1"
                  >
                    {project.website_url}
                  </a>
                )}
                {project.fiverr_order_id && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Fiverr ID:</span> {project.fiverr_order_id}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Created {formatDistanceToNow(new Date(project.created_at))} ago
                </p>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No projects found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">@{member.username}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full">
                    {member.role.replace('_', ' ')}
                  </span>
                  {member.team_type && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-full">
                      {member.team_type}
                    </span>
                  )}
                </div>
                {/* Edit User Button - Only for authorized roles */}
                {['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session?.user.role || '') && (
                  <button
                    type="button"
                    onClick={() => setShowEditUserModal(member)}
                    className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Edit User
                  </button>
                )}
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No team members found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{task.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {task.project_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {task.assigned_to_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${priorityColors[task.priority as keyof typeof priorityColors] || ''}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[task.status as keyof typeof statusColors] || ''}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(task.created_at))} ago
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rework Analysis Tab with Time Filter */}
        {activeTab === 'rework' && (
          <div className="space-y-4">
            {/* Time Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Time Period Filter</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing rework tasks for the selected time period. Total counts remain visible for all time.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIME_FILTERS.map((filter) => (
                    <button
                      type="button"
                      key={filter.days}
                      onClick={() => handleTimeFilterChange(filter.days)}
                      disabled={reworkLoading}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        selectedDays === filter.days
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      } ${reworkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              {reworkLoading && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  Updating data...
                </div>
              )}
            </div>

            {/* Rework Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalReworkCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Rework (All Time)</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{filteredReworkCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Rework ({TIME_FILTERS.find(f => f.days === selectedDays)?.label})
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {userReworkStats.filter(u => u.total_rework_count > 0).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Users with Rework</div>
              </div>
            </div>

            {/* Rework Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Rework (All Time)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Period Rework ({TIME_FILTERS.find(f => f.days === selectedDays)?.label})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {userReworkStats.length > 0 ? (
                      userReworkStats.map((user, index) => (
                        <tr 
                          key={user.id} 
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                            user.filtered_rework_count > 0 ? '' : 'opacity-60'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' 
                                : index === 1
                                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                : index === 2
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                                : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {user.role.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {user.team_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1.5 text-sm font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 rounded-full">
                              {user.total_rework_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1.5 text-sm font-bold rounded-full ${
                              user.filtered_rework_count > 0
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {user.filtered_rework_count}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No rework data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                💡 <strong>Total Rework</strong> shows lifetime counts that never reset. <strong>Period Rework</strong> updates based on selected time filter.
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && (
          <UserEditModal
            user={showEditUserModal}
            onClose={() => setShowEditUserModal(null)}
            onUpdated={() => {
              fetchOverviewData();
              setShowEditUserModal(null);
            }}
            onDelete={() => {
              fetchOverviewData();
            }}
            currentUserRole={session?.user.role || ''}
          />
        )}
      </main>
    </div>
  );
}