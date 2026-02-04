// src/app/dashboard/page.tsx
// src/app/dashboard/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import CreateTaskModal from './create-task-modal';
import QAReviewModal from './qa-review-modal';
import TaskDetailSidebar from './task-detail-sidebar';
import NotificationToast from './NotificationToast';
import EditTaskModal from './edit-task-modal';
import QAAssignModal from './qa-assign-modal';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  created_at?: string;
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

// ─── Column colour accents (purely decorative) ──────────────────────────────
const COLUMN_COLORS: Record<string, { dot: string; header: string }> = {
  IN_PROGRESS: { dot: 'bg-blue-500', header: 'text-blue-700 dark:text-blue-300' },
  WAITING_FOR_QA: { dot: 'bg-amber-500', header: 'text-amber-700 dark:text-amber-300' },
  APPROVED: { dot: 'bg-emerald-500', header: 'text-emerald-700 dark:text-emerald-300' },
  REWORK: { dot: 'bg-rose-500', header: 'text-rose-700 dark:text-rose-300' },
};

export default function KanbanBoard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  // ═══════════════════════════════════════════════════════════════════════════
  //  STATE — 100 % identical to original
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ── NEW: project-details panel open/closed on small screens ──
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(true);
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

  const [activeTimers, setActiveTimers] = useState<Record<string, {
    start_time: Date;
    is_rework: boolean;
    elapsed_seconds: number;
  }>>({});

  const [timerStatus, setTimerStatus] = useState<Record<string, 'AVAILABLE' | 'RUNNING' | 'WARNING' | 'EXCEEDED' | 'USED' | 'APPROVED'>>({});

  const shownNotifications = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  //  EFFECTS & HANDLERS — 100 % identical logic to original
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;
  }, []);

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

  useEffect(() => {
    if (!session) return;
    const checkPermission = () => {
      if (!('Notification' in window)) return;
      setNotificationPermission(Notification.permission);
    };
    checkPermission();
  }, [session]);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.error('Failed to play notification sound:', e);
      });
    }
  }, []);

  const showDesktopNotification = useCallback((
    title: string,
    message: string,
    taskId?: string,
    playSound: boolean = true
  ) => {
    // Always play sound if requested
    if (playSound) {
      playNotificationSound();
    }

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return;
    }

    // If permission is not granted, don't show desktop notification
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: taskId || `notification-${Date.now()}`,
        requireInteraction: false,
        silent: !playSound, // Only make sound if playSound is true
      });

      notification.onclick = function (event) {
        event.preventDefault();
        window.focus();
        if (taskId) {
          window.location.href = `/dashboard?task=${taskId}`;
        }
        notification.close();
      };

      // Auto-close after 10 seconds
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
    if (notification.taskId) setSelectedTaskId(notification.taskId);
    removeNotification(notification.id);
  };

  // ✅ FIXED: Proper notification permission handling
  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Your browser does not support desktop notifications');
      return;
    }

    // Check current permission
    let permission = Notification.permission;

    // If denied, show instructions
    if (permission === 'denied') {
      toast.error('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }

    // If not granted, request permission
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    // Handle result
    if (permission === 'granted') {
      setNotificationPermission('granted');
      setNotificationBannerDismissed(true);
      localStorage.setItem('notificationBannerDismissed', 'true');

      // Show success notification
      showDesktopNotification(
        '✅ Notifications Enabled!',
        'You will now receive desktop alerts for task updates.',
        undefined,
        true
      );
    } else if (permission === 'denied') {
      toast.error('Notifications were blocked. Please enable them in browser settings.');
    }
  };

  const handleDismissBanner = () => {
    setNotificationBannerDismissed(true);
    localStorage.setItem('notificationBannerDismissed', 'true');
  };

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
          setTeamMembers((data.users || []).map((u: any) => ({ ...u, role: u.role || '' })));
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

  const fetchTasks = useCallback(async () => {
    try {
      let url = '/api/tasks';
      if (projectId) url += `?project=${projectId}`;
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
      const taskIds = Object.keys(tasksMap);
      taskIds.forEach(taskId => {
        const task = tasksMap[taskId];
        const assignedRole = (task as any).assigned_to_role || task.assigned_to || '';
        if (
          task.status === 'IN_PROGRESS' &&
          task.assigned_to &&
          !['QA', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(assignedRole)
        ) {
          // Timer handled by existing polling logic
        }
      });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }, [projectId]);

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
    const timerInterval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          const timer = updated[taskId];
          if (timer) {
            const elapsed = Math.floor((Date.now() - timer.start_time.getTime()) / 1000);
            updated[taskId] = { ...timer, elapsed_seconds: elapsed };
            const task = tasks[taskId];
            if (task?.estimated_minutes) {
              const estimatedSeconds = task.estimated_minutes * 60;
              const remainingSeconds = estimatedSeconds - elapsed;
              if (remainingSeconds <= 0) {
                setTimerStatus(prev => ({ ...prev, [taskId]: 'EXCEEDED' }));
              } else if (remainingSeconds <= estimatedSeconds * 0.2) { // Last 20% of time
                setTimerStatus(prev => ({ ...prev, [taskId]: 'WARNING' }));
              }
            }
          }
        });
        return updated;
      });
      if (Date.now() % 10000 < 1000) {
        fetchActiveTimers();
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [columns, tasks]);

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
              case 'TASK_APPROVED':
                title = '✅ Task Approved!';
                message = `Task "${note.task_title}" has been approved by QA`;
                break;
              case 'TASK_REWORK':
                title = '🔄 Task Needs Rework!';
                message = `Task "${note.task_title}" has been sent back for rework by QA`;
                break;
              case 'TASK_RESUBMITTED':
                title = '📤 Task Resubmitted for QA!';
                message = `Task "${note.task_title}" has been resubmitted and is ready for your review`;
                break;
              case 'TASK_COMPLETED':
                title = '✅ Task Completed!';
                message = `Task "${note.task_title}" has been completed by ${note.assignee_name || 'assignee'}`;
                break;
              default:
                continue;
            }

            // ✅ ALWAYS show desktop notification (even when tab is inactive)
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
    const interval = setInterval(pollNotifications, 5000);
    return () => clearInterval(interval);
  }, [session, showDesktopNotification, showInAppNotification]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/login'); return; }
    if (session.user.role === 'QA') {
      fetchQaProjects();
    } else {
      fetchProjects();
      fetchTeamMembers();
    }
  }, [session, status, router, fetchProjects, fetchTeamMembers, fetchQaProjects]);

  useEffect(() => {
    if (session) fetchTasks();
  }, [session, projectId, fetchTasks]);

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

  // ✅ NEW: Handle Complete Task (replaces Stop Timer)
  const handleCompleteTask = async (taskId: string) => {
    try {
      // First, stop the timer
      const stopRes = await fetch(`/api/timers/${taskId}/stop`, { method: 'POST' });
      if (!stopRes.ok) {
        const data = await stopRes.json();
        toast.error(data.error || 'Failed to stop timer');
        return;
      }
      const timerData = await stopRes.json();

      // Then, move task to WAITING_FOR_QA
      const updateRes = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WAITING_FOR_QA' }),
      });
      if (!updateRes.ok) {
        const data = await updateRes.json();
        toast.error(data.error || 'Failed to complete task');
        return;
      }

      // Success - show appropriate message
      if (timerData.timeExceeded) {
        toast.error(`Task completed and submitted for QA!
Duration: ${Math.floor(timerData.duration_seconds / 60)}m ${timerData.duration_seconds % 60}s
⏰ TIME LIMIT EXCEEDED!`, { duration: 6000 });
      } else {
        toast.success(`Task completed and submitted for QA!
Duration: ${Math.floor(timerData.duration_seconds / 60)}m ${timerData.duration_seconds % 60}s`);
      }

      // Update local state
      setActiveTimers(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      setTimerStatus(prev => ({
        ...prev,
        [taskId]: 'USED'
      }));

      // Refresh tasks
      fetchTasks();
    } catch (err) {
      toast.error('Network error');
    }
  };

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
        setTimerStatus(prev => ({ ...prev, [taskId]: 'RUNNING' }));
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const getStatusTransitionMessage = (oldStatus: string, newStatus: string, taskTitle: string) => {
    if (oldStatus === 'IN_PROGRESS' && newStatus === 'WAITING_FOR_QA') return `Submitted "${taskTitle}" for QA review`;
    if (newStatus === 'APPROVED') return `Approved "${taskTitle}"`;
    if (newStatus === 'REWORK') return `Requested rework for "${taskTitle}"`;
    return `Moved "${taskTitle}" to ${newStatus}`;
  };

  const onDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const startCol = columns[source.droppableId];
    const finishCol = columns[destination.droppableId];
    if (!startCol || !finishCol) return;
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    // ✅ CLEAR QA ASSIGNMENT when moving to REWORK
    if (newStatus === 'REWORK' && oldStatus !== 'REWORK') {
      try {
        const res = await fetch(`/api/tasks/${draggableId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'REWORK',
            qa_assigned_to: null,
            qa_assigned_to_name: null,
            qa_assigned_at: null
          }),
        });
        if (res.ok) {
          fetchTasks(); // Refresh tasks
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to move task to rework');
        }
      } catch (err) {
        alert('Network error');
      }
      return;
    }

    if (session?.user?.role === 'QA') {
      if (newStatus === 'WAITING_FOR_QA') {
        alert('Only assignees can resubmit tasks for QA review');
        fetchTasks();
        return;
      }
    }

    const newStartTaskIds = Array.from(startCol.taskIds);
    newStartTaskIds.splice(source.index, 1);
    const newFinishTaskIds = Array.from(finishCol.taskIds);
    newFinishTaskIds.splice(destination.index, 0, draggableId);
    setColumns({
      ...columns,
      [source.droppableId]: { ...startCol, taskIds: newStartTaskIds },
      [destination.droppableId]: { ...finishCol, taskIds: newFinishTaskIds },
    });

    const task = tasks[draggableId];
    if (!task || !session?.user) { fetchTasks(); return; }
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

  // Countdown logic for timer
  const calculateTimeRemaining = (taskId: string, estimatedMinutes?: number | null) => {
    if (!estimatedMinutes || !activeTimers[taskId]) return null;
    const elapsedSeconds = activeTimers[taskId].elapsed_seconds;
    const totalSeconds = estimatedMinutes * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    return {
      minutes: Math.floor(remainingSeconds / 60),
      seconds: remainingSeconds % 60,
      isExceeded: elapsedSeconds > totalSeconds
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (status === 'loading') {
    return <div className="p-6 text-gray-800 dark:text-gray-200">Loading…</div>;
  }

  const currentProject = projects.find(p => p.id === projectId);
  const shouldShowNotificationBanner = !notificationBannerDismissed && notificationPermission !== 'granted';

  // Which columns the current user sees (logic unchanged)
  const visibleColumns = Object.values(columns).filter(column => {
    const isQA = session?.user?.role === 'QA';
    if (isQA && column.id === 'WAITING_FOR_QA') return false;
    return true;
  });

  return (
    <div className="w-full max-w-full">
      {/* ─── Top bar: title + actions ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {currentProject ? currentProject.name : 'All Projects'}
            </h1>
            {currentProject && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage tasks and track progress</p>
            )}
          </div>
          {/* Overview link */}
          {['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER'].includes(session?.user.role || '') && (
            <Link
              href="/dashboard/overview"
              className="shrink-0 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              Overview
            </Link>
          )}
          {/* Notification bell */}
          {notificationPermission !== 'granted' && (
            <div className="relative shrink-0">
              <button
                onClick={handleRequestPermission}
                onMouseEnter={() => setShowNotificationTooltip(true)}
                onMouseLeave={() => setShowNotificationTooltip(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Enable notifications"
              >
                <svg className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  {notificationPermission === 'denied' && (
                    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  )}
                </svg>
                {notificationPermission === 'default' && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-gray-100 dark:border-gray-800 animate-pulse" />
                )}
              </button>
              {showNotificationTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-xl shadow-xl z-50">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-gray-800 rotate-45" />
                  <p className="font-semibold mb-0.5">
                    {notificationPermission === 'denied' ? 'Notifications Blocked' : 'Enable Notifications'}
                  </p>
                  <p className="text-gray-300 leading-snug">
                    {notificationPermission === 'denied'
                      ? 'Enable in browser settings for real-time alerts'
                      : 'Get instant alerts for tasks & time warnings'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Add Task button */}
        {(session?.user?.role === 'ADMIN' ||
          session?.user?.role === 'PROJECT_MANAGER' ||
          session?.user?.role === 'TEAM_LEADER') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              + Add Task
            </button>
          )}
      </div>

      {/* ─── Notification Banner ─────────────────────────────────────── */}
      {shouldShowNotificationBanner && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {notificationPermission === 'denied' ? 'Notifications are blocked' : 'Stay updated with real-time alerts'}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                {notificationPermission === 'denied'
                  ? 'Enable in browser settings'
                  : 'Enable desktop notifications for instant updates'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {notificationPermission === 'default' && (
              <button onClick={handleRequestPermission} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
                Enable
              </button>
            )}
            <button onClick={handleDismissBanner} className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" aria-label="Dismiss">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── Project Details — collapsible strip (shows above grid on ≤lg) */}
      <div className="mb-4">
        {/* Toggle header */}
        <button
          onClick={() => setProjectDetailsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              Project Details
              {projectDetails && <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">— {projectDetails.name}</span>}
            </span>
          </div>
          {projectDetailsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {/* Collapsible body */}
        {projectDetailsOpen && (
          <div className="mt-2 px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
            {projectDetailsLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : projectDetails ? (
              <div className="flex items-end flex-wrap gap-x-6 gap-y-2">
                <div>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Name</span>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{projectDetails.name}</p>
                </div>
                {projectDetails.description && (
                  <div>
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Description</span>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{projectDetails.description}</p>
                  </div>
                )}
                {projectDetails.client_name && (
                  <div>
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Client</span>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{projectDetails.client_name}</p>
                  </div>
                )}
                {projectDetails.website_url && (
                  <div>
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide block">Website</span>
                    <a href={projectDetails.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      {projectDetails.website_url}
                    </a>
                  </div>
                )}
                {projectDetails.fiverr_order_id && (
                  <div>
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Fiverr Order</span>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{projectDetails.fiverr_order_id}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No project selected</p>
            )}
          </div>
        )}
      </div>

      {/* ─── Kanban Grid */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="
          grid gap-3
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
          items-start
          "
        >
          {visibleColumns.map((column) => {
            const colors = COLUMN_COLORS[column.id] || { dot: 'bg-gray-400', header: 'text-gray-700' };
            return (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col"
                    style={{ minHeight: '160px' }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                      <h2 className={`flex items-center gap-2 text-sm font-bold ${colors.header}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                        {column.title}
                      </h2>
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {column.taskIds.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
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
                                  if (session?.user?.role === 'QA') {
                                    if (clickedTask.qa_assigned_to === session.user.id) setSelectedTaskId(clickedTask.id);
                                    return;
                                  }
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
                                  } else {
                                    setSelectedTaskId(clickedTask.id);
                                  }
                                }}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all duration-150 active:scale-[0.98]"
                              >
                                {/* Title */}
                                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug">{task.title}</h3>
                                {/* Assignee */}
                                {task.assigned_to_name && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                                      {task.assigned_to_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{task.assigned_to_name}</span>
                                  </div>
                                )}
                                {/* Description snippet */}
                                {task.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
                                )}
                                {/* QA badge */}
                                {task.qa_assigned_to && (
                                  <div className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    QA Assigned
                                  </div>
                                )}
                                {/* Timer indicators */}
                                {/* RUNNING countdown display */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'RUNNING' && (
                                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center text-xs font-medium text-green-700 dark:text-green-300">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                        {task.estimated_minutes ? 'Time Remaining' : 'Timer Running'}
                                      </div>
                                      {activeTimers[task.id]?.is_rework && (
                                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full">
                                          🔄 Rework
                                        </span>
                                      )}
                                    </div>
                                    {task.estimated_minutes ? (
                                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {calculateTimeRemaining(task.id, task.estimated_minutes)?.minutes}m {calculateTimeRemaining(task.id, task.estimated_minutes)?.seconds}s
                                      </div>
                                    ) : (
                                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {Math.floor(activeTimers[task.id]?.elapsed_seconds / 60)}m {activeTimers[task.id]?.elapsed_seconds % 60}s
                                      </div>
                                    )}
                                    {task.estimated_minutes && (
                                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                                          style={{
                                            width: `${Math.max(0, Math.min(100, ((task.estimated_minutes * 60 - activeTimers[task.id]?.elapsed_seconds) / (task.estimated_minutes * 60)) * 100))}%`,
                                          }}
                                        ></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* WARNING state countdown */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'WARNING' && (
                                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-300 dark:border-yellow-700">
                                    <div className="flex items-center text-xs text-yellow-700 dark:text-yellow-300">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                                      ⚠️ Time Running Low!
                                    </div>
                                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                      {calculateTimeRemaining(task.id, task.estimated_minutes)?.minutes}m {calculateTimeRemaining(task.id, task.estimated_minutes)?.seconds}s
                                    </div>
                                  </div>
                                )}
                                {/* EXCEEDED state countdown */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'EXCEEDED' && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-300 dark:border-red-700">
                                    <div className="flex items-center text-xs text-red-700 dark:text-red-300">
                                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-ping"></div>
                                      ⏰ Time Exceeded!
                                    </div>
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                      -{Math.floor((activeTimers[task.id]?.elapsed_seconds - (task.estimated_minutes || 0) * 60) / 60)}m {(activeTimers[task.id]?.elapsed_seconds - (task.estimated_minutes || 0) * 60) % 60}s
                                    </div>
                                  </div>
                                )}

                                {/* Priority + Timer controls row */}
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${task.priority === 'HIGH'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                    : task.priority === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    }`}>
                                    {task.priority}
                                  </span>
                                  {/* ✅ Timer controls - Complete Task instead of Stop Timer */}
                                  {task.status !== 'APPROVED' && task.assigned_to === session?.user?.id && timerStatus[task.id] !== 'USED' && (
                                    <>
                                      {timerStatus[task.id] === 'AVAILABLE' && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleStartTimer(task.id); }}
                                          className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                                        >
                                          ▶ Start
                                        </button>
                                      )}
                                      {(timerStatus[task.id] === 'RUNNING' || timerStatus[task.id] === 'WARNING' || timerStatus[task.id] === 'EXCEEDED') && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
                                          className={`px-2 py-0.5 text-[10px] font-bold text-white rounded-md transition-colors ${timerStatus[task.id] === 'EXCEEDED'
                                            ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                        >
                                          ✅ Complete
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                                {/* Timer used */}
                                {task.status !== 'APPROVED' && timerStatus[task.id] === 'USED' && (
                                  <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 italic">✓ Timer completed</p>
                                )}
                                {/* Task Created Date */}
                                {task.created_at && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                    <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.25 2.25M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" /></svg>
                                    <span>Created: {new Date(task.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
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
            );
          })}
        </div>
      </DragDropContext>

      {/* ─── Modals (all original, untouched) ─────────────────────────── */}
      {showCreateModal && (
        <CreateTaskModal projects={projects} teamMembers={teamMembers} onClose={() => setShowCreateModal(false)} />
      )}
      {selectedTaskId && (
        <TaskDetailSidebar taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
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
        <QAAssignModal taskId={showQAAssignModal} onClose={() => setShowQAAssignModal(null)} />
      )}
      {showQAModal && (
        <QAReviewModal
          taskId={showQAModal.taskId}
          taskTitle={showQAModal.taskTitle}
          taskDescription={showQAModal.taskDescription}
          onClose={() => setShowQAModal(null)}
        />
      )}

      {/* In-app notification toasts */}
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