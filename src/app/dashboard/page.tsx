// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CreateTaskModal from './create-task-modal';
import QAReviewModal from './qa-review-modal';
import TaskDetailSidebar from './task-detail-sidebar'; // ← NEW

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
};

type Column = {
  id: string;
  title: string;
  taskIds: string[];
};

type TasksMap = Record<string, Task>;

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

  const [columns, setColumns] = useState<Record<string, Column>>(initialColumns);
  const [tasks, setTasks] = useState<TasksMap>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQAModal, setShowQAModal] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null); // ← for detail sidebar
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  useEffect(() => {
    if (
      session?.user?.role === 'ADMIN' ||
      session?.user?.role === 'PROJECT_MANAGER' ||
      session?.user?.role === 'TEAM_LEADER'
    ) {
      fetch('/api/projects')
        .then((res) => res.json())
        .then((data) => setProjects(data.projects || []));

      fetch('/api/users/team')
        .then((res) => res.json())
        .then((data) => setTeamMembers(data.users || []));
    }
  }, [session]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();

      const tasksMap: TasksMap = {};
      const cols: Record<string, Column> = {
        PENDING: { id: 'PENDING', title: 'Pending', taskIds: [] },
        IN_PROGRESS: { id: 'IN_PROGRESS', title: 'In Progress', taskIds: [] },
        WAITING_FOR_QA: { id: 'WAITING_FOR_QA', title: 'Waiting for QA', taskIds: [] },
        APPROVED: { id: 'APPROVED', title: 'Approved', taskIds: [] },
        REWORK: { id: 'REWORK', title: 'Rework', taskIds: [] },
      };

      (data.tasks || []).forEach((task: Task) => {
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
  };

  // (handleStartTimer and handleStopTimer NOT used in this file but left for completeness)
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

  const onDragEnd = async (result: DropResult) => {
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

    if (!session?.user) {
      alert('Not authenticated');
      fetchTasks();
      return;
    }
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
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update task');
        fetchTasks();
      }
    } catch (err) {
      console.error('Update failed');
      fetchTasks();
    }
  };

  if (status === 'loading') {
    return <div className="p-6 text-gray-800 dark:text-gray-200">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Project Board</h1>

      {(session?.user?.role === 'ADMIN' ||
        session?.user?.role === 'PROJECT_MANAGER' ||
        session?.user?.role === 'TEAM_LEADER') && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="mb-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          + Create Task
        </button>
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
                              onClick={() => setSelectedTaskId(task.id)} // ← Open detail sidebar
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

      {/* Modals & Sidebar */}
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
    </div>
  );
}