// src/app/dashboard/[projectId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import CreateTaskModal from '../create-task-modal';
import QAReviewModal from '../qa-review-modal';
import TaskDetailSidebar from '../task-detail-sidebar';

// Add 'role' to User type to match what CreateTaskModal expects
type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string;
  project_id: string;
  priority: string;
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

export default function ProjectDashboard() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [columns, setColumns] = useState<Record<string, Column>>(initialColumns);
  const [tasks, setTasks] = useState<TasksMap>({});
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQAModal, setShowQAModal] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      }
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
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

  const fetchTeamMembers = useCallback(async () => {
    if (
      session?.user.role === 'ADMIN' ||
      session?.user.role === 'PROJECT_MANAGER' ||
      session?.user.role === 'TEAM_LEADER'
    ) {
      try {
        const res = await fetch('/api/users/team');
        if (res.ok) {
          const data = await res.json();
          // Defensive: Make sure each returned user has a 'role'
          const usersWithRole: User[] = (data.users || []).map((user: any) => ({
            id: user.id,
            name: user.name,
            username: user.username,
            team_type: user.team_type,
            role: user.role ?? '', // fallback to empty string if missing
          }));
          setTeamMembers(usersWithRole);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchProject();
    fetchTasks();
    fetchTeamMembers();
  }, [session, status, projectId, fetchProject, fetchTasks, fetchTeamMembers, router]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const startCol = columns[source.droppableId];
    const finishCol = columns[destination.droppableId];

    // Move within same column
    if (startCol === finishCol) {
      const newTaskIds = Array.from(startCol.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      const newColumn = { ...startCol, taskIds: newTaskIds };
      setColumns({
        ...columns,
        [newColumn.id]: newColumn,
      });
      return;
    }

    // Move between columns
    const startTaskIds = Array.from(startCol.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = { ...startCol, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finishCol.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finishCol, taskIds: finishTaskIds };

    // Optionally update task status in memory
    const updatedTask = {
      ...tasks[draggableId],
      status: finishCol.id,
    };
    setTasks({
      ...tasks,
      [draggableId]: updatedTask,
    });
    setColumns({
      ...columns,
      [newStart.id]: newStart,
      [newFinish.id]: newFinish,
    });

    fetch(`/api/tasks/${draggableId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: finishCol.id }),
    }).catch((err) => {
      console.error('Failed to update task status', err);
    });
  };

  if (status === 'loading') {
    return <div className="p-6">Loading...</div>;
  }

  if (!project) {
    return <div className="p-6">Project not found</div>;
  }

  // --- FIX: Add the required props (taskTitle, taskDescription) to QAReviewModal ---
  // We fetch the task using showQAModal (which is the taskId).
  const qaTask =
    showQAModal && tasks[showQAModal]
      ? tasks[showQAModal]
      : null;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{project.name}</h1>

        {(session?.user.role === 'ADMIN' ||
          session?.user.role === 'PROJECT_MANAGER' ||
          session?.user.role === 'TEAM_LEADER') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Add Task
          </button>
        )}
      </div>

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
                              onClick={() => setSelectedTaskId(task.id)}
                              className="bg-white dark:bg-gray-700 p-4 rounded shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md"
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
          projects={[{ id: projectId, name: project.name }]}
          teamMembers={teamMembers}
          onClose={() => {
            setShowCreateModal(false);
            fetchTasks();
          }}
        />
      )}

      {showQAModal && qaTask && (
        <QAReviewModal
          taskId={qaTask.id}
          taskTitle={qaTask.title}
          taskDescription={qaTask.description}
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