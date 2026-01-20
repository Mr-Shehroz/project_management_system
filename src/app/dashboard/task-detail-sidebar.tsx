// src/app/dashboard/task-detail-sidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to_name: string;
  assigned_by_name: string;
  project_name: string;
  created_at: string;
};

export default function TaskDetailSidebar({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    if (!taskId) return;

    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/detail`);
        if (res.ok) {
          const data = await res.json();
          setTask(data.task);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="w-96 bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700">
          Loading...
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="w-96 bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700">
          Task not found
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      ></div>
      <div className="w-96 bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 relative z-50">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{task.title}</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">
              {task.description || 'No description'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Project</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">{task.project_name}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned To</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">{task.assigned_to_name}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned By</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">{task.assigned_by_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
              <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                task.priority === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {task.priority}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
              <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                {task.status}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">
              {new Date(task.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}