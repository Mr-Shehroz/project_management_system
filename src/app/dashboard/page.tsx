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

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string;
  project_id: string;
  priority: string;
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
  PENDING: { id: 'PENDING', title: 'Pending', taskIds: [] },
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
  const [showQAModal, setShowQAModal] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Track shown notifications to avoid duplicates
  const shownNotifications = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;
  }, []);

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
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
          console.log('✅ Notification permission granted!');
          // Show test notification
          showDesktopNotification(
            'Notifications Enabled!',
            'You will now receive task notifications even when this tab is inactive.',
            undefined,
            false // Don't play sound for welcome message
          );
        } else if (permission === 'denied') {
          console.error('❌ Notification permission denied');
          alert('Please enable notifications in your browser settings to receive task alerts.');
        }
      } else if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted');
      } else {
        console.error('❌ Notification permission was denied');
      }
    };

    checkAndRequestPermission();
  }, [session]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reset to start
      audioRef.current.play().catch(e => {
        console.error('Failed to play notification sound:', e);
      });
    }
  }, []);

  // Show desktop notification (works even when browser is minimized)
  const showDesktopNotification = useCallback((
    title: string,
    message: string,
    taskId?: string,
    playSound: boolean = true
  ) => {
    // Play sound first
    if (playSound) {
      playNotificationSound();
    }

    // Check if notifications are supported and permitted
    if (!('Notification' in window)) {
      console.error('Browser does not support notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted. Current status:', Notification.permission);
      return;
    }

    try {
      // Create desktop notification
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: taskId || `notification-${Date.now()}`,
        requireInteraction: false,
        silent: false, // Allow sound
        // @ts-expect-error 'vibrate' is a valid Notification option in some browsers but not in the TS type
        vibrate: [200, 100, 200],
      });

      console.log('✅ Desktop notification created:', title);

      // Handle notification click
      notification.onclick = function (event) {
        event.preventDefault();
        console.log('Notification clicked');

        // Focus the window
        window.focus();

        // Navigate to task if taskId provided
        if (taskId) {
          window.location.href = `/dashboard?task=${taskId}`;
        }

        // Close the notification
        notification.close();
      };

      // Auto close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Handle notification errors
      notification.onerror = function (event) {
        console.error('Notification error:', event);
      };

    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }, [playNotificationSound]);

  // Show in-app toast notification (only when page is active)
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

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error(err);
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
        console.error(err);
      }
    }
  }, [session]);

  // Fetch tasks
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
        PENDING: { ...initialColumns.PENDING, taskIds: [] },
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
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  // Poll for notifications (THIS IS THE KEY PART)
  useEffect(() => {
    if (!session) return;

    const pollNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();

          // Find unread notifications that haven't been shown yet
          const unread = data.notifications.filter((n: any) =>
            !n.is_read && !shownNotifications.current.has(n.id)
          );

          console.log(`Found ${unread.length} new notifications`);

          // Process each new notification
          for (const note of unread) {
            // Add to shown set to prevent duplicates
            shownNotifications.current.add(note.id);

            console.log('Showing notification:', note);

            // ALWAYS show desktop notification (works even when tab is inactive)
            showDesktopNotification(
              '🔔 New Task Assigned',
              `You have been assigned a task in "${note.project_name}"`,
              note.task_id,
              true // Play sound
            );

            // Also show in-app toast if page is visible
            if (document.visibilityState === 'visible') {
              showInAppNotification(
                'New Task Assigned',
                `You have been assigned a task in "${note.project_name}"`,
                note.task_id
              );
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

    // Poll immediately on mount
    console.log('Starting notification polling...');
    pollNotifications();

    // Then poll every 10 seconds
    const interval = setInterval(() => {
      console.log('Polling for notifications...');
      pollNotifications();
    }, 10000);

    return () => {
      console.log('Stopping notification polling');
      clearInterval(interval);
    };
  }, [session, showDesktopNotification, showInAppNotification]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchProjects();
    fetchTeamMembers();
  }, [session, status, router, fetchProjects, fetchTeamMembers]);

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session, projectId, fetchTasks]);

  // Timer handlers
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
        fetchTasks();
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
        alert(`Timer stopped! Duration: ${data.duration} minutes`);
        fetchTasks();
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Get status transition message
  const getStatusTransitionMessage = (oldStatus: string, newStatus: string, taskTitle: string) => {
    if (oldStatus === 'PENDING' && newStatus === 'IN_PROGRESS') {
      return `Started working on "${taskTitle}"`;
    }
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

    // Validate permissions based on status change
    if (oldStatus === 'PENDING' && task.assigned_to !== session.user.id) {
      alert('Only the assigned member can start this task');
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
      // Handle special case: moving to WAITING_FOR_QA
      if (newStatus === 'WAITING_FOR_QA' && oldStatus === 'IN_PROGRESS') {
        // Send notification to Admin, PM, and Team Leader
        const notifyRes = await fetch('/api/notifications/qa-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            task_id: draggableId,
            project_id: task.project_id
          }),
        });

        if (!notifyRes.ok) {
          console.error('Failed to send QA request notification');
        }
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
        // Success - refresh tasks
        fetchTasks();
        
        // Show success message
        const message = getStatusTransitionMessage(oldStatus, newStatus, task.title);
        console.log(message);
      }
    } catch (err) {
      console.error('Update failed:', err);
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
                  ? 'Please enable notifications in your browser settings to receive alerts when you\'re assigned new tasks.'
                  : 'Get alerts for new task assignments even when this tab is inactive or your browser is minimized.'}
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
            ✅ Desktop notifications enabled - You'll receive alerts even when this tab is inactive
          </p>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex overflow-x-auto pb-4 -mx-2 px-2">
          {Object.values(columns).map((column) => (
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
                                // Open QA modal if task is waiting for QA and user is authorized
                                if (task.status === 'WAITING_FOR_QA') {
                                  if (session?.user?.role === 'ADMIN' || 
                                      session?.user?.role === 'PROJECT_MANAGER' || 
                                      session?.user?.role === 'TEAM_LEADER') {
                                    setShowQAModal(task.id);
                                  } else if (session?.user?.role === 'QA') {
                                    setShowQAModal(task.id);
                                  }
                                } else {
                                  setSelectedTaskId(task.id);
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
                              <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>Priority: {task.priority}</span>
                                <span>{task.assigned_to}</span>
                              </div>
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

      {showQAModal && (
        <QAReviewModal
          taskId={showQAModal}
          onClose={() => setShowQAModal(null)}
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

      {/* Render In-App Notifications (only when page is visible) */}
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