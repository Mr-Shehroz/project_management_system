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

type Note = {
  id: string;
  user_id: string;
  note: string;
  note_type: string; // 'COMMENT', 'APPROVAL', 'REJECTION'
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [noteLoading, setNoteLoading] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!taskId) return;

    const fetchTaskAndNotes = async () => {
      try {
        // Fetch task details
        const taskRes = await fetch(`/api/tasks/${taskId}/detail`);
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          setTask(taskData.task);
        }

        // Fetch all notes for this task (unified)
        const notesRes = await fetch(`/api/notes?task_id=${taskId}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskAndNotes();
  }, [taskId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !session) return;

    setNoteLoading(true);
    try {
      // Unified notes API
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task_id: taskId, 
          note: newNote,
          note_type: 'COMMENT'
        }),
      });

      if (res.ok) {
        setNewNote('');
        // Re-fetch all notes
        const notesRes = await fetch(`/api/notes?task_id=${taskId}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes || []);
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add note');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setNoteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="w-96 bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700">
          Loading task details...
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
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 relative z-50 overflow-y-auto max-h-screen">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold"
        >
          &times;
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

          {/* Unified Activity Feed */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white">Activity</h3>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div 
                    key={note.id} 
                    className={`p-3 rounded ${
                      note.note_type === 'APPROVAL' 
                        ? 'bg-green-100 dark:bg-green-900 border-l-4 border-green-500' :
                      note.note_type === 'REJECTION' 
                        ? 'bg-red-100 dark:bg-red-900 border-l-4 border-red-500' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <p className="text-sm text-gray-800 dark:text-gray-200">{note.note}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {note.note_type === 'APPROVAL' && (
                        <span className="inline-block mr-2 px-2 py-0.5 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-[10px] font-medium">
                          Approved
                        </span>
                      )}
                      {note.note_type === 'REJECTION' && (
                        <span className="inline-block mr-2 px-2 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded text-[10px] font-medium">
                          Rejected
                        </span>
                      )}
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet</p>
              )}
            </div>

            {/* Add Comment - Available to all roles */}
            <div className="mt-3 flex">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l px-3 py-1 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              />
              <button
                onClick={handleAddNote}
                disabled={noteLoading || !newNote.trim()}
                className="bg-blue-600 text-white px-3 py-1 rounded-r hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {noteLoading ? 'Adding...' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}