// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
  project_id: string;
  priority: string;
  estimated_minutes?: number | null;
  // Added for QA Assignment status
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

  // Request notification permission on mount
  useEffect(() => {
    if (!session) return;

    const checkAndRequestPermission = async () => {
      if (!('Notification' in window)) {
        console.error('This browser does not support desktop notifications');
        return;
      }

      setNotificationPermission(Notification.permission);

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
          showDesktopNotification(
            'Notifications Enabled!',
            'You will now receive task notifications even when this tab is inactive.',
            undefined,
            false
          );
        } else if (permission === 'denied') {
          alert('Please enable notifications in your browser settings to receive task alerts.');
        }
      }
    };

    checkAndRequestPermission();
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
        // If task is assigned to non-QA and in IN_PROGRESS, check if timer should be running
        // Use 'assigned_to_role' only if it exists on type Task, otherwise fallback to 'assigned_to'
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

    // In your pollNotifications function:
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
              case 'READY_FOR_ASSIGNMENT': // ✅ ADD THIS
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
    }, 5000); // Poll every 5 seconds for faster real-time notifications

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

  const handleStartTimer = async (taskId: string) => {
    try {
      const res = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to start timer');
      } else {
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
      alert('Network error');
    }
  };

  const handleStopTimer = async (taskId: string) => {
    try {
      const res = await fetch(`/api/timers/${taskId}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to stop timer');
      } else {
        const data = await res.json();
        const minutes = Math.floor(data.duration_seconds / 60);
        const seconds = data.duration_seconds % 60;

        if (data.timeExceeded) {
          alert(`⚠️ Timer stopped!\n\nDuration: ${minutes}m ${seconds}s\nEstimated: ${data.estimated_minutes} minutes\n\n⏰ TIME LIMIT EXCEEDED!\nNotifications sent to Team Leaders, Project Managers, and Admins.`);
        } else {
          alert(`✅ Timer stopped!\n\nDuration: ${minutes}m ${seconds}s`);
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
      alert('Network error');
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
      alert('Only QA can review this task');
      fetchTasks();
      return;
    }

    if (newStatus === 'WAITING_FOR_QA' && task.assigned_to !== session.user.id) {
      alert('Only the assigned member can submit for QA');
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
        alert(data.error || 'Failed to update task');
        fetchTasks();
      } else {
        fetchTasks();
      }
    } catch (err) {
      fetchTasks();
    }
  };

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showDesktopNotification(
          'Success!',
          'Desktop notifications are now enabled.',
          undefined,
          true
        );
      }
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

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {currentProject ? currentProject.name : 'All Projects'}
        </h1>

        {(session?.user?.role === 'ADMIN' ||
          session?.user?.role === 'PROJECT_MANAGER' ||
          session?.user?.role === 'TEAM_LEADER') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Add Task
            </button>
          )}
      </div>

      {/* Notification Permission Banner */}
      {notificationPermission !== 'granted' && (
        <div className={`mb-4 p-4 rounded-lg border ${notificationPermission === 'denied'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${notificationPermission === 'denied'
                ? 'text-red-800 dark:text-red-200'
                : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                {notificationPermission === 'denied'
                  ? '⚠️ Desktop notifications are blocked'
                  : '🔔 Enable desktop notifications'}
              </p>
              <p className={`text-sm mt-1 ${notificationPermission === 'denied'
                ? 'text-red-600 dark:text-red-300'
                : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                {notificationPermission === 'denied'
                  ? 'Please enable notifications in your browser settings to receive real-time alerts for task assignments and time limit warnings.'
                  : 'Get instant alerts for new tasks and when time limits are exceeded - even when this tab is inactive.'}
              </p>
            </div>
            {notificationPermission === 'default' && (
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap ml-4"
              >
                Enable Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success message when notifications are enabled */}
      {notificationPermission === 'granted' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✅ Desktop notifications enabled - You'll receive instant alerts for task assignments and time warnings
          </p>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex items-start overflow-x-auto pb-4 -mx-2 px-2">
          {/* Project Details Panel */}
          <div className="min-w-[280px] sm:min-w-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mr-4">
            <h2 className="font-bold mb-4 text-gray-800 dark:text-white">Project Details</h2>
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
              // ✅ Hide WAITING_FOR_QA column for QA role
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
                    className="min-w-[280px] sm:min-w-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mr-4"
                  >
                    <h2 className="font-bold mb-4 text-gray-800 dark:text-white">{column.title}</h2>
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
                                  // existing click handler logic
                                  const clickedTask = tasks[taskId];
                                  if (!clickedTask) return;

                                  // Check if QA was already assigned
                                  const isQaAlreadyAssigned = !!clickedTask.qa_assigned_at;

                                  if (
                                    session?.user?.role === 'ADMIN' ||
                                    session?.user?.role === 'PROJECT_MANAGER' ||
                                    session?.user?.role === 'TEAM_LEADER'
                                  ) {
                                    // Only show QA Assign Modal if QA hasn't been assigned yet
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
                                className="bg-white dark:bg-gray-700 p-4 rounded shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md transition-shadow"
                              >
                                <h3 className="font-semibold text-gray-800 dark:text-white">{task.title}</h3>

                                {task.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}

                                {/* ✅ QA Assignment Status */}
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

                                {/* ... rest of the card ... */}
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

                                <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span>Priority: {task.priority}</span>
                                  <span>{task.assigned_to}</span>
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