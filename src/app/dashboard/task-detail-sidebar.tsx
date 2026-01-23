// src/app/dashboard/task-detail-sidebar.tsx
'use client';

import { useEffect, useState, KeyboardEvent, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

// Add missing and proper typings for TaskDetail (was missing several fields used in the Edit event)
type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to_name: string;
  assigned_by_name: string;
  assigned_by_id?: string; // Allow for missing id
  assigned_to?: string;
  qa_assigned_to?: string | null;
  estimated_minutes?: number | null;
  project_name: string;
  project_id?: string;
  team_type?: string;
  created_at: string;
  files?: Array<{
    url: string;
    public_id: string;
    resource_type: string;
    original_name: string;
    format: string;
    bytes: number;
  }>;
};

type Note = {
  id: string;
  user_id: string;
  note: string;
  note_type: string; // 'COMMENT', 'APPROVAL', 'REJECTION', 'FEEDBACK_IMAGE'
  created_at: string;
  metadata?: string;
  meta?: string; // Also accept 'meta' (bugfix for wrong property downstream)
};

// Helper function to get file icon based on extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return '🖼️';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) return '🎥';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext || '')) return '🎵';
  if (['pdf'].includes(ext || '')) return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx'].includes(ext || '')) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '📦';
  if (['txt'].includes(ext || '')) return '📃';

  return '📎';
};

// Helper function to get file type label
const getFileTypeLabel = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'Image';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) return 'Video';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext || '')) return 'Audio';
  if (['pdf'].includes(ext || '')) return 'PDF';
  if (['doc', 'docx'].includes(ext || '')) return 'Word';
  if (['xls', 'xlsx'].includes(ext || '')) return 'Excel';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'Archive';

  return 'File';
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
        const taskRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/detail`);
        if (!taskRes.ok) throw new Error('Failed to fetch task');
        const taskData = await taskRes.json();
        setTask(taskData.task);

        // Fetch all notes for this task (unified)
        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (!notesRes.ok) throw new Error('Failed to fetch notes');
        const notesData = await notesRes.json();
        setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
      } catch (err) {
        // Avoid spamming error logs in production, but for debug, this is fine
        if (typeof process !== "undefined" && process.env.NODE_ENV !== 'production') console.error(err);
        setTask(null);
        setNotes([]);
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
        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
        }
      } else {
        let errorMsg = 'Failed to add note';
        try {
          const error = await res.json();
          errorMsg = error?.error || errorMsg;
        } catch { }
        // eslint-disable-next-line no-alert
        alert(errorMsg);
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
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
        aria-label="Close sidebar overlay"
        tabIndex={-1}
        role="button"
      ></div>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 relative z-50 overflow-y-auto max-h-screen">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold"
          aria-label="Close details"
          type="button"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{task.title}</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
            <p className="mt-1 text-gray-800 dark:text-gray-200">
              {typeof task.description === 'string' && task.description && task.description.trim()
                ? task.description
                : 'No description'}
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

          {/* Edit Button - Only for task assigner or admin */}
          {(session?.user?.role === 'ADMIN' ||
            (!!task.assigned_by_id && session?.user?.id === task.assigned_by_id)) && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    // Dispatch custom event to parent
                    const event = new CustomEvent('edit-task', {
                      detail: {
                        id: task.id,
                        project_id: task.project_id ?? '',
                        team_type: task.team_type ?? '',
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        assigned_to: task.assigned_to ?? '',
                        qa_assigned_to: task.qa_assigned_to ?? '',
                        estimated_minutes: task.estimated_minutes ?? null,
                        status: task.status,
                        files: task.files ?? []
                      }
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                  type="button"
                >
                  Edit Task
                </button>
              </div>
            )}

          {/* Files Section - With Safety Checks */}
          {task.files && Array.isArray(task.files) && task.files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-800 dark:text-white mb-3">
                Attachments ({task.files.length})
              </h3>
              <div className="space-y-2">
                {task.files.map((file, index) => {
                  if (!file || typeof file !== 'object') return null;

                  const isImage = file.resource_type === 'image';

                  return (
                    <div key={file.public_id || String(index)} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-start space-x-3">
                        {/* Preview/Icon */}
                        <div className="flex-shrink-0">
                          {isImage ? (
                            <img
                              src={file.url}
                              alt={file.original_name || `Attachment ${index + 1}`}
                              className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-2xl">
                              {getFileIcon(file.original_name || `File ${index + 1}`)}
                            </div>
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {getFileTypeLabel(file.original_name || `File ${index + 1}`)}
                            </span>
                            {typeof file.bytes === "number" && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.bytes / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1 truncate" title={file.original_name || `File ${index + 1}`}>
                            {file.original_name || `File ${index + 1}`}
                          </p>

                          {/* Media Preview */}
                          {isImage && (
                            <img
                              src={file.url}
                              alt={file.original_name || `Attachment ${index + 1}`}
                              className="mt-2 w-full rounded border border-gray-300 dark:border-gray-600"
                              style={{ maxHeight: '200px' }}
                            />
                          )}

                          {/* Download Link */}
                          <a
                            href={`/api/download?public_id=${encodeURIComponent(file.public_id || '')}&resource_type=${encodeURIComponent(file.resource_type || '')}&filename=${encodeURIComponent(file.original_name || `File ${index + 1}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download {file.original_name || `File ${index + 1}`}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
              <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${task.priority === 'HIGH'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : task.priority === 'MEDIUM'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
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
              {task.created_at ? new Date(task.created_at).toLocaleString() : ''}
            </p>
          </div>

          {/* Unified Activity Feed */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white">Activity</h3>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {Array.isArray(notes) && notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded ${note.note_type === 'APPROVAL'
                      ? 'bg-green-100 dark:bg-green-900 border-l-4 border-green-500'
                      : note.note_type === 'REJECTION'
                        ? 'bg-red-100 dark:bg-red-900 border-l-4 border-red-500'
                        : note.note_type === 'FEEDBACK_IMAGE'
                          ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                  >
                    {/* Main Note */}
                    {note.note_type !== 'FEEDBACK_IMAGE' && (
                      <p className="text-sm text-gray-800 dark:text-gray-200">{note.note}</p>
                    )}

                    {note.note_type === 'FEEDBACK_IMAGE' && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{note.note}</p>
                        {(note.meta || note.metadata) && (
                          (() => {
                            try {
                              const metaRaw = note.meta ?? note.metadata;
                              const meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;

                              if (meta && meta.image && meta.image.url) {
                                // Ensure we have a complete URL
                                let imageUrl = meta.image.url;

                                // If URL doesn't start with http, construct Cloudinary URL
                                if (!imageUrl.startsWith('http') && meta.image.public_id) {
                                  const format = meta.image.format || 'jpg';
                                  imageUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${meta.image.public_id}.${format}`;
                                }

                                return (
                                  <div className="mt-2">
                                    <a
                                      href={imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt="Feedback"
                                        className="w-full rounded border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                                        onError={(e) => {
                                          // Fallback if image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            const fallback = document.createElement('div');
                                            fallback.className = 'bg-gray-200 dark:bg-gray-700 p-4 rounded text-center text-sm text-gray-600 dark:text-gray-400';
                                            fallback.innerHTML = `
                          <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p>Image failed to load</p>
                          <p class="text-xs mt-1">${meta.image.original_name || 'Unknown file'}</p>
                        `;
                                            parent.appendChild(fallback);
                                          }
                                        }}
                                      />
                                    </a>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {meta.image.original_name || 'Feedback image'}
                                      {meta.image.bytes && ` • ${(meta.image.bytes / 1024).toFixed(1)} KB`}
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded text-center text-sm text-gray-600 dark:text-gray-400">
                                  <p>No image data available</p>
                                </div>
                              );
                            } catch (e) {
                              console.error('Error parsing feedback image metadata:', e);
                              return (
                                <div className="bg-red-100 dark:bg-red-900 p-3 rounded text-center text-sm text-red-600 dark:text-red-400">
                                  <p>Error loading image</p>
                                </div>
                              );
                            }
                          })()
                        )}
                      </div>
                    )}

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
                      <span>{note.created_at ? new Date(note.created_at).toLocaleString() : ''}</span>
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNote(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l px-3 py-1 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                aria-label="Add a comment"
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  // @ts-ignore
                  const key = e.key ?? e.code;
                  if (
                    (key === 'Enter' || e.keyCode === 13) &&
                    !noteLoading &&
                    newNote.trim()
                  ) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={noteLoading || !newNote.trim()}
                className="bg-blue-600 text-white px-3 py-1 rounded-r hover:bg-blue-700 disabled:opacity-50 text-sm"
                type="button"
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