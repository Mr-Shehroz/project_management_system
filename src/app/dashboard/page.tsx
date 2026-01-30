// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import CreateTaskModal from './create-task-modal';
import QAReviewModal from './qa-review-modal';
import TaskDetailSidebar from './task-detail-sidebar';
import NotificationToast from './NotificationToast';
import EditTaskModal from './edit-task-modal';
import QAAssignModal from './qa-assign-modal';

// --- UPDATED Task Type ---
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string;
  assigned_to_name?: string;
  project_id: string;
  priority: string;
  estimated_minutes?: number | null;
  qa_assigned_to?: string | null;
  qa_assigned_to_name?: string | null;
  qa_assigned_at?: string | null;
};

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

type Column = {
  id: string;
  title: string;
  taskIds: string[];
};

type TasksMap = Record<string, Task>;

type Notification = {
  id: string;
  title: string;
  message: string;
  taskId?: string;
  timestamp: Date;
};

const initialColumns: Record<string, Column> = {
  IN_PROGRESS: { id: 'IN_PROGRESS', title: 'In Progress', taskIds: [] },
  WAITING_FOR_QA: { id: 'WAITING_FOR_QA', title: 'Waiting for QA', taskIds: [] },
  APPROVED: { id: 'APPROVED', title: 'Approved', taskIds: [] },
  REWORK: { id: 'REWORK', title: 'Rework', taskIds: [] },
};

export default function KanbanBoard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  const [columns, setColumns] = useState<Record<string, Column>>(initialColumns);
  const [tasks, setTasks] = useState<TasksMap>({});
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<{ task: any } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationBannerDismissed, setNotificationBannerDismissed] = useState(false);
  const [showNotificationTooltip, setShowNotificationTooltip] = useState(false);

  // Project details state
  const [projectDetails, setProjectDetails] = useState<{
    name: string;
    description: string | null;
    client_name: string | null;
    website_url: string | null;
    fiverr_order_id: string | null;
  } | null>(null);

  const [showQAModal, setShowQAModal] = useState<{
    taskId: string;
    taskTitle: string;
    taskDescription: string | null;
  } | null>(null);

  const [showQAAssignModal, setShowQAAssignModal] = useState<string | null>(null);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);

  // Timer state with seconds
  const [activeTimers, setActiveTimers] = useState<Record<string, {
    start_time: Date;
    is_rework: boolean;
    elapsed_seconds: number;
  }>>({});

  // Timer status map for each task
  const [timerStatus, setTimerStatus] = useState<Record<string, 'AVAILABLE' | 'RUNNING' | 'WARNING' | 'EXCEEDED' | 'USED' | 'APPROVED'>>({});

  // Track shown notifications to avoid duplicates
  const shownNotifications = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;
  }, []);

  // Load dismissed state from localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem('notificationBannerDismissed');
    if (dismissed === 'true') {
      setNotificationBannerDismissed(true);
    }
  }, []);

  useEffect(() => {
    const handleQaFeedback = (e: CustomEvent) => {
      setShowQAModal({
        taskId: e.detail.taskId,
        taskTitle: e.detail.taskTitle,
        taskDescription: e.detail.taskDescription || null
      });
    };

    window.addEventListener('qa-feedback', handleQaFeedback as EventListener);
    return () => window.removeEventListener('qa-feedback', handleQaFeedback as EventListener);
  }, []);

  // Fetch project details
  useEffect(() => {
    const fetchProjectDetails = async () => {
      let targetProjectId = projectId;
      if (!targetProjectId && selectedTaskId && tasks[selectedTaskId]) {
        targetProjectId = tasks[selectedTaskId].project_id;
      }

      if (!targetProjectId) {
        setProjectDetails(null);
        setProjectDetailsLoading(false);
        return;
      }

      setProjectDetailsLoading(true);
      try {
        const res = await fetch(`/api/projects/${targetProjectId}`);
        if (res.ok) {
          const data = await res.json();
          setProjectDetails(data.project || null);
        } else {
          setProjectDetails(null);
        }
      } catch (err) {
        console.error('Failed to fetch project details:', err);
        setProjectDetails(null);
      } finally {
        setProjectDetailsLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId, selectedTaskId, tasks]);

  useEffect(() => {
    const handleEditTask = (e: CustomEvent) => {
      setShowEditModal({ task: e.detail });
    };

    window.addEventListener('edit-task', handleEditTask as EventListener);
    return () => window.removeEventListener('edit-task', handleEditTask as EventListener);
  }, []);

  // Request notification permission on mount - silently check
  useEffect(() => {
    if (!session) return;

    const checkPermission = () => {
      if (!('Notification' in window)) {
        return;
      }
      setNotificationPermission(Notification.permission);
    };

    checkPermission();
  }, [session]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.error('Failed to play notification sound:', e);
      });
    }
  }, []);

  // Show desktop notification
  const showDesktopNotification = useCallback((
    title: string,
    message: string,
    taskId?: string,
    playSound: boolean = true
  ) => {
    if (playSound) {
      playNotificationSound();
    }

    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: taskId || `notification-${Date.now()}`,
        requireInteraction: false,
        silent: false,
        // @ts-expect-error 'vibrate' is a valid Notification option in some browsers but not in the TS type
        vibrate: [200, 100, 200],
      });

      notification.onclick = function (event) {
        event.preventDefault();
        window.focus();
        if (taskId) {
          window.location.href = `/dashboard?task=${taskId}`;
        }
        notification.close();
      };

      setTimeout(() => {
        notification.close();
      }, 10000);

      notification.onerror = function (event) {
        console.error('Notification error:', event);
      };
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
    }
  }, [playNotificationSound]);

  // Show in-app toast notification
  const showInAppNotification = useCallback((title: string, message: string, taskId?: string) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      title,
      message,
      taskId,
      timestamp: new Date()
    };

    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.taskId) {
      setSelectedTaskId(notification.taskId);
    }
    removeNotification(notification.id);
  };

  // Handle requesting notification permission
  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showDesktopNotification(
          'Notifications Enabled!',
          'You will now receive real-time alerts.',
          undefined,
          true
        );
        // Auto-dismiss the banner after granting permission
        setNotificationBannerDismissed(true);
        localStorage.setItem('notificationBannerDismissed', 'true');
      } else if (permission === 'denied') {
        toast.error('Please enable notifications in your browser settings.');
      }
    }
  };

  // Handle dismissing the banner
  const handleDismissBanner = () => {
    setNotificationBannerDismissed(true);
    localStorage.setItem('notificationBannerDismissed', 'true');
  };

  // Fetch projects for non-QA users
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    if (
      session?.user?.role === 'ADMIN' ||
      session?.user?.role === 'PROJECT_MANAGER' ||
      session?.user?.role === 'TEAM_LEADER'
    ) {
      try {
        const res = await fetch('/api/users/team');
        if (res.ok) {
          const data = await res.json();
          setTeamMembers((data.users || []).map((u: any) => ({
            ...u,
            role: u.role || '',
          })));
        }
      } catch (err) {
        console.error('Failed to fetch team members:', err);
      }
    }
  }, [session]);

  const fetchQaProjects = useCallback(async () => {
    if (session?.user?.role === 'QA') {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const data = await res.json();
          const projectIds = [...new Set((data.tasks || []).map((t: any) => t.project_id))];
          if (projectIds.length > 0) {
            const projectsRes = await fetch('/api/projects');
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              setProjects((projectsData.projects || []).filter((p: any) => projectIds.includes(p.id)));
            }
          } else {
            setProjects([]);
          }
        }
      } catch (err) {
        setProjects([]);
      }
    }
  }, [session]);

  // In your fetchTasks function
  const fetchTasks = useCallback(async () => {
    try {
      let url = '/api/tasks';
      if (projectId) {
        url += `?project=${projectId}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();

      const tasksMap: TasksMap = {};
      const cols: Record<string, Column> = {
        IN_PROGRESS: { ...initialColumns.IN_PROGRESS, taskIds: [] },
        WAITING_FOR_QA: { ...initialColumns.WAITING_FOR_QA, taskIds: [] },
        APPROVED: { ...initialColumns.APPROVED, taskIds: [] },
        REWORK: { ...initialColumns.REWORK, taskIds: [] }
      };

      data.tasks.forEach((task: Task) => {
        tasksMap[task.id] = task;
        if (cols[task.status]) {
          cols[task.status].taskIds.push(task.id);
        }
      });

      setTasks(tasksMap);
      setColumns(cols);

      // ✅ Check for auto-started timers
      const taskIds = Object.keys(tasksMap);
      taskIds.forEach(taskId => {
        const task = tasksMap[taskId];
        const assignedRole = (task as any).assigned_to_role || task.assigned_to || '';
        if (
          task.status === 'IN_PROGRESS' &&
          task.assigned_to &&
          !['QA', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(assignedRole)
        ) {
          // Timer will be handled by the existing timer polling logic
        }
      });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }, [projectId]);

  // Fetch timer status and info on mount/when columns change
  useEffect(() => {
    const fetchActiveTimers = async () => {
      const taskIds = Object.values(columns).flatMap(col => col.taskIds);

      const timerPromises = taskIds.map(async (taskId) => {
        try {
          const res = await fetch(`/api/timers/${taskId}/current`);
          if (res.ok) {
            const data = await res.json();
            return { taskId, timer: data.timer, status: data.status };
          }
        } catch (err) {
          console.error(`Failed to fetch timer for task ${taskId}:`, err);
        }
        return { taskId, timer: null, status: 'AVAILABLE' };
      });

      const results = await Promise.all(timerPromises);

      const activeTimersMap: Record<string, any> = {};
      const statusMap: Record<string, any> = {};

      results.forEach(result => {
        statusMap[result.taskId] = result.status || 'AVAILABLE';
        if (result.timer) {
          activeTimersMap[result.taskId] = {
            start_time: new Date(result.timer.start_time),
            is_rework: result.timer.is_rework,
            elapsed_seconds: result.timer.elapsed_seconds
          };
        }
      });

      setTimerStatus(statusMap);
      setActiveTimers(activeTimersMap);
    };

    fetchActiveTimers();

    // ✅ Update every second AND check for status changes
    const timerInterval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          const timer = updated[taskId];
          if (timer) {
            const elapsed = Math.floor((Date.now() - timer.start_time.getTime()) / 1000);
            updated[taskId] = { ...timer, elapsed_seconds: elapsed };

            // Update status based on elapsed time
            const task = tasks[taskId];
            if (task?.estimated_minutes) {
              const estimatedSeconds = task.estimated_minutes * 60;
              if (elapsed >= estimatedSeconds) {
                setTimerStatus(prev => ({ ...prev, [taskId]: 'EXCEEDED' }));
              } else if (elapsed >= estimatedSeconds * 0.8) {
                setTimerStatus(prev => ({ ...prev, [taskId]: 'WARNING' }));
              }
            }
          }
        });
        return updated;
      });

      // ✅ ALSO re-fetch timer status every 10 seconds to catch backend notifications
      if (Date.now() % 10000 < 1000) {
        fetchActiveTimers();
      }
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, [columns, tasks]);

  // Poll for notifications
  useEffect(() => {
    if (!session) return;

    const pollNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();

          const unread = data.notifications.filter((n: any) =>
            !n.is_read && !shownNotifications.current.has(n.id)
          );

          for (const note of unread) {
            shownNotifications.current.add(note.id);

            let title = '';
            let message = '';

            switch (note.type) {
              case 'TASK_ASSIGNED':
                title = '🔔 New Task Assigned';
                message = `You have been assigned a task in "${note.project_name}"`;
                break;
              case 'QA_REVIEWED':
                title = '🔍 QA Review Requested';
                message = `Task "${note.task_title}" needs QA review`;
                break;
              case 'TIME_EXCEEDED':
                title = '⏰ Time Limit Exceeded!';
                message = `Task "${note.task_title}" has exceeded its time limit`;
                break;
              case 'HELP_REQUEST':
                title = '🆘 Help Requested!';
                message = `User "${note.requester_name}" needs help with task "${note.task_title}"`;
                break;
              case 'READY_FOR_ASSIGNMENT':
                title = '✅ Ready for Assignment!';
                message = `Task "${note.task_title}" in project "${note.project_name}" is ready for assignment`;
                break;
              default:
                continue;
            }

            // ✅ ALWAYS show desktop notification (even when tab is minimized)
            showDesktopNotification(title, message, note.task_id, true);

            // Show in-app toast ONLY if page is visible
            if (document.visibilityState === 'visible') {
              showInAppNotification(title, message, note.task_id);
            }

            // Mark as read
            try {
              await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: note.id })
              });
            } catch (e) {
              console.error('Failed to mark notification as read:', e);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll notifications:', err);
      }
    };

    pollNotifications();
    const interval = setInterval(() => {
      pollNotifications();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [session, showDesktopNotification, showInAppNotification]);

  // Fetch projects logic
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    if (session.user.role === 'QA') {
      fetchQaProjects();
    } else {
      fetchProjects();
      fetchTeamMembers();
    }
  }, [session, status, router, fetchProjects, fetchTeamMembers, fetchQaProjects]);

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session, projectId, fetchTasks]);

  // Real-time updates: Listen for refresh-tasks event
  useEffect(() => {
    const handleRefreshTasks = () => {
      fetchTasks();
      if (session?.user?.role === 'QA') {
        fetchQaProjects();
      } else {
        fetchProjects();
        fetchTeamMembers();
      }
    };

    window.addEventListener('refresh-tasks', handleRefreshTasks);
    return () => window.removeEventListener('refresh-tasks', handleRefreshTasks);
  }, [session, fetchTasks, fetchProjects, fetchTeamMembers, fetchQaProjects]);

  const handleStartTimer = async (taskId: string) => {
    try {
      const res = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to start timer');
      } else {
        toast.success('Timer started');
        setActiveTimers(prev => ({
          ...prev,
          [taskId]: {
            start_time: new Date(),
            is_rework: tasks[taskId]?.status === 'REWORK',
            elapsed_seconds: 0
          }
        }));
        setTimerStatus(prev => ({
          ...prev,
          [taskId]: 'RUNNING'
        }));
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleStopTimer = async (taskId: string) => {
    try {
      const res = await fetch(`/api/timers/${taskId}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to stop timer');
      } else {
        const data = await res.json();
        const minutes = Math.floor(data.duration_seconds / 60);
        const seconds = data.duration_seconds % 60;

        if (data.timeExceeded) {
          toast.error(`Timer stopped! Duration: ${minutes}m ${seconds}s | Estimated: ${data.estimated_minutes} minutes | TIME LIMIT EXCEEDED! Notifications sent to Team Leaders, Project Managers, and Admins.`, {
            duration: 6000,
          });
        } else {
          toast.success(`Timer stopped! Duration: ${minutes}m ${seconds}s`);
        }

        setActiveTimers(prev => {
          const updated = { ...prev };
          delete updated[taskId];
          return updated;
        });

        setTimerStatus(prev => ({
          ...prev,
          [taskId]: 'USED'
        }));
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const getStatusTransitionMessage = (oldStatus: string, newStatus: string, taskTitle: string) => {
    if (oldStatus === 'IN_PROGRESS' && newStatus === 'WAITING_FOR_QA') {
      return `Submitted "${taskTitle}" for QA review`;
    }
    if (newStatus === 'APPROVED') {
      return `Approved "${taskTitle}"`;
    }
    if (newStatus === 'REWORK') {
      return `Requested rework for "${taskTitle}"`;
    }
    return `Moved "${taskTitle}" to ${newStatus}`;
  };

  // Drag & Drop
  const onDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const startCol = columns[source.droppableId];
    const finishCol = columns[destination.droppableId];
    if (!startCol || !finishCol) return;

    const newStartTaskIds = Array.from(startCol.taskIds);
    newStartTaskIds.splice(source.index, 1);
    const newFinishTaskIds = Array.from(finishCol.taskIds);
    newFinishTaskIds.splice(destination.index, 0, draggableId);

    const newColumns = {
      ...columns,
      [source.droppableId]: { ...startCol, taskIds: newStartTaskIds },
      [destination.droppableId]: { ...finishCol, taskIds: newFinishTaskIds },
    };

    setColumns(newColumns);

    const task = tasks[draggableId];
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    if (!task || !session?.user) {
      fetchTasks();
      return;
    }

    if (oldStatus === 'WAITING_FOR_QA' && session.user.role !== 'QA') {
      toast.error('Only QA can review this task');
      fetchTasks();
      return;
    }

    if (newStatus === 'WAITING_FOR_QA' && task.assigned_to !== session.user.id) {
      toast.error('Only the assigned member can submit for QA');
      fetchTasks();
      return;
    }

    try {
      if (newStatus === 'WAITING_FOR_QA' && oldStatus === 'IN_PROGRESS') {
        await fetch('/api/notifications/qa-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: draggableId,
            project_id: task.project_id
          }),
        });
      }

      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to update task');
        fetchTasks();
      } else {
        toast.success(`Task moved to ${columns[newStatus]?.title || newStatus}`);
        fetchTasks();
      }
    } catch (err) {
      toast.error('Network error');
      fetchTasks();
    }
  };

  // Helper function to format timer display
  const formatTimerDisplay = (seconds: number, estimatedMinutes?: number | null) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${minutes}m ${secs}s`;

    if (estimatedMinutes) {
      const estimatedSeconds = estimatedMinutes * 60;
      const percentage = Math.round((seconds / estimatedSeconds) * 100);
      return `${timeStr} (${percentage}%)`;
    }

    return timeStr;
  };

  if (status === 'loading') {
    return <div className="p-6 text-gray-800 dark:text-gray-200">Loading...</div>;
  }

  const currentProject = projects.find(p => p.id === projectId);

  // Determine if we should show the notification banner
  const shouldShowNotificationBanner = 
    !notificationBannerDismissed && 
    notificationPermission !== 'granted';

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
              {currentProject ? currentProject.name : 'All Projects'}
            </h1>
            {currentProject && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage tasks and track progress
              </p>
            )}
          </div>

          {/* Notification Bell Icon with Tooltip */}
          {notificationPermission !== 'granted' && (
            <div className="relative">
              <button
                onClick={handleRequestPermission}
                onMouseEnter={() => setShowNotificationTooltip(true)}
                onMouseLeave={() => setShowNotificationTooltip(false)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Enable notifications"
              >
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                  {notificationPermission === 'denied' && (
                    <line
                      x1="4"
                      y1="4"
                      x2="20"
                      y2="20"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                {notificationPermission === 'default' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Tooltip */}
              {showNotificationTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-lg shadow-xl z-50">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-gray-800"></div>
                  {notificationPermission === 'denied' ? (
                    <>
                      <p className="font-medium mb-1">Notifications Blocked</p>
                      <p className="text-xs opacity-90">
                        Enable in your browser settings to receive real-time task alerts
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium mb-1">Enable Notifications</p>
                      <p className="text-xs opacity-90">
                        Get instant alerts for task assignments and time warnings
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {(session?.user?.role === 'ADMIN' ||
          session?.user?.role === 'PROJECT_MANAGER' ||
          session?.user?.role === 'TEAM_LEADER') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              + Add Task
            </button>
          )}
      </div>

      {/* Compact Dismissible Notification Banner */}
      {shouldShowNotificationBanner && (
        <div className="mb-4 p-3 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {notificationPermission === 'denied'
                    ? 'Notifications are blocked'
                    : 'Stay updated with real-time alerts'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {notificationPermission === 'denied'
                    ? 'Enable in browser settings for task notifications'
                    : 'Enable desktop notifications for instant updates'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {notificationPermission === 'default' && (
                <button
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-medium whitespace-nowrap"
                >
                  Enable
                </button>
              )}
              <button
                onClick={handleDismissBanner}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
                aria-label="Dismiss"
              >
                <svg
                  className="w-4 h-4 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Kanban Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="
            flex
            items-start
            gap-4
            overflow-x-auto
            pb-4
            scrollbar-thin
            scrollbar-thumb-gray-300
            scrollbar-track-gray-100
            dark:scrollbar-thumb-gray-600
            dark:scrollbar-track-gray-800
            w-full
            max-w-full
            relative
            "
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Project Details Panel */}
          <div
            className="
              min-w-[250px] 
              max-w-[320px]
              w-[90vw]
              sm:w-[300px] 
              md:w-[280px]
              md:min-w-[260px]
              lg:w-[320px] 
              xl:w-[340px]
              bg-white dark:bg-gray-800 
              rounded-xl p-4 shadow-lg border 
              border-gray-200 dark:border-gray-700 
              flex-shrink-0
              flex-grow-0
            "
            style={{
              flex: '0 0 auto',
            }}
          >
            <h2 className="font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
              Project Details
            </h2>
            {projectDetailsLoading ? (
              <p className="text-gray-500 dark:text-gray-400">Loading project details...</p>
            ) : projectDetails ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
                  <p className="mt-1 text-gray-800 dark:text-gray-200">{projectDetails.name}</p>
                </div>
                {projectDetails.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{projectDetails.description}</p>
                  </div>
                )}
                {projectDetails.client_name && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</h3>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{projectDetails.client_name}</p>
                  </div>
                )}
                {projectDetails.website_url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Website</h3>
                    <a
                      href={projectDetails.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {projectDetails.website_url}
                    </a>
                  </div>
                )}
                {projectDetails.fiverr_order_id && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Fiverr Order ID</h3>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{projectDetails.fiverr_order_id}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No project selected</p>
            )}
          </div>

          {/* Kanban Columns */}
          {Object.values(columns)
            .filter(column => {
              if (session?.user?.role === 'QA' && column.id === 'WAITING_FOR_QA') {
                return false;
              }
              return true;
            })
            .map((column) => (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`
                      bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700 flex-shrink-0 flex-grow-0
                      min-w-[250px]
                      sm:min-w-[260px]
                      md:min-w-[280px]
                      md:max-w-[320px]
                      w-[90vw]
                      sm:w-[300px]
                      md:w-[280px]
                      lg:w-[320px]
                      xl:w-[340px]
                      mx-0
                    `}
                    style={{
                      flex: '0 0 auto',
                    }}
                  >
                    <h2 className="font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                      <div className="w-2 h-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                      {column.title}
                    </h2>
                    <div className="space-y-3">
                      {column.taskIds.map((taskId, index) => {
                        const task = tasks[taskId];
                        if (!task) return null;
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => {
                                  const clickedTask = tasks[taskId];
                                  if (!clickedTask) return;

                                  const isQaAlreadyAssigned = !!clickedTask.qa_assigned_at;

                                  if (
                                    session?.user?.role === 'ADMIN' ||
                                    session?.user?.role === 'PROJECT_MANAGER' ||
                                    session?.user?.role === 'TEAM_LEADER'
                                  ) {
                                    if (clickedTask.status === 'WAITING_FOR_QA' && !isQaAlreadyAssigned) {
                                      setShowQAAssignModal(clickedTask.id);
                                    } else {
                                      setSelectedTaskId(clickedTask.id);
                                    }
                                  } else if (session?.user?.role === 'QA') {
                                    setSelectedTaskId(clickedTask.id);
                                  } else {
                                    setSelectedTaskId(clickedTask.id);
                                  }
                                }}
                                className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                              >
                                {/* Task Title */}
                                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 line-clamp-2">{task.title}</h3>

                                {/* Assignee Badge */}
                                {task.assigned_to_name && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                      {task.assigned_to_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                      {task.assigned_to_name}
                                    </span>
                                  </div>
                                )}

                                {task.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}

                                {/* QA Assignment Status */}
                                {task.qa_assigned_to && (
                                  <div className="mt-1 flex items-center text-xs text-blue-600 dark:text-blue-400">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    QA Assigned
                                  </div>
                                )}

                                {/* Timer Status Indicators */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'RUNNING' && (
                                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                                    <div className="flex items-center text-xs text-green-700 dark:text-green-300">
                                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                      <span className="font-medium">
                                        {formatTimerDisplay(activeTimers[task.id]?.elapsed_seconds || 0, task.estimated_minutes)}
                                      </span>
                                    </div>
                                    {activeTimers[task.id]?.is_rework && (
                                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                        🔄 Rework
                                      </div>
                                    )}
                                  </div>
                                )}

                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'WARNING' && (
                                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-300 dark:border-yellow-700">
                                    <div className="flex items-center text-xs text-yellow-700 dark:text-yellow-300">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                                      <span className="font-medium">
                                        ⚠️ {formatTimerDisplay(activeTimers[task.id]?.elapsed_seconds || 0, task.estimated_minutes)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                      Approaching time limit
                                    </div>
                                  </div>
                                )}

                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'EXCEEDED' && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-300 dark:border-red-700">
                                    <div className="flex items-center text-xs text-red-700 dark:text-red-300">
                                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                                      <span className="font-medium">
                                        ⏰ {formatTimerDisplay(activeTimers[task.id]?.elapsed_seconds || 0, task.estimated_minutes)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                                      Time exceeded - Managers notified!
                                    </div>
                                  </div>
                                )}

                                {/* Priority Badge */}
                                <div className="mt-2 flex items-center justify-between">
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    task.priority === 'HIGH'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : task.priority === 'MEDIUM'
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </div>

                                {/* Timer Controls */}
                                {task.status !== 'APPROVED' && task.assigned_to === session?.user?.id && timerStatus[task.id] !== 'USED' && (
                                  <div className="mt-2 flex space-x-2">
                                    {timerStatus[task.id] === 'AVAILABLE' ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartTimer(task.id);
                                        }}
                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                      >
                                        ▶ Start Timer
                                      </button>
                                    ) : (timerStatus[task.id] === 'RUNNING' || timerStatus[task.id] === 'WARNING' || timerStatus[task.id] === 'EXCEEDED') ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStopTimer(task.id);
                                        }}
                                        className={`px-2 py-1 text-xs text-white rounded transition-colors ${timerStatus[task.id] === 'EXCEEDED'
                                          ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                          : 'bg-orange-600 hover:bg-orange-700'
                                          }`}
                                      >
                                        ⏹ Stop Timer
                                      </button>
                                    ) : null}
                                  </div>
                                )}

                                {/* Timer Used Message */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'USED' && (
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                    ✓ Timer completed
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
        </div>
      </DragDropContext>

      {showCreateModal && (
        <CreateTaskModal
          projects={projects}
          teamMembers={teamMembers}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {selectedTaskId && (
        <TaskDetailSidebar
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {showEditModal && (
        <EditTaskModal
          task={showEditModal.task}
          projects={projects}
          teamMembers={teamMembers}
          onClose={() => setShowEditModal(null)}
          onUpdated={fetchTasks}
        />
      )}

      {showQAAssignModal && (
        <QAAssignModal
          taskId={showQAAssignModal}
          onClose={() => setShowQAAssignModal(null)}
        />
      )}

      {showQAModal && (
        <QAReviewModal
          taskId={showQAModal.taskId}
          taskTitle={showQAModal.taskTitle}
          taskDescription={showQAModal.taskDescription}
          onClose={() => setShowQAModal(null)}
        />
      )}

      {/* Render In-App Notifications */}
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          onClick={() => handleNotificationClick(notification)}
        />
      ))}
    </div>
  );
}