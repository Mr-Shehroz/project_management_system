// src/app/dashboard/task-detail-sidebar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

// Corrected and enhanced types
type TaskFile = {
  url: string;
  public_id: string;
  resource_type: string;
  original_name: string;
  format: string;
  bytes: number;
};

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to_name: string;
  assigned_by_name: string;
  assigned_by_id?: string;
  assigned_to?: string;
  qa_assigned_to?: string | null;
  estimated_minutes?: number | null;
  project_name: string;
  project_id: string;
  team_type?: string;
  created_at: string;
  files?: TaskFile[];
};

type Note = {
  id: string;
  user_id: string;
  note: string;
  note_type: string;
  created_at: string;
  metadata?: any;
};

type ProjectDetails = {
  id: string;
  name: string;
  client_name?: string;
  website_url?: string;
};

// Utility functions
function getFileIcon(filename: string) {
  if (typeof filename !== 'string') return '📎';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return '🎥';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return '🎵';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  if (['txt'].includes(ext)) return '📃';
  return '📎';
}

function getFileTypeLabel(filename: string) {
  if (typeof filename !== 'string') return 'File';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'Image';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return 'Video';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'Audio';
  if (['pdf'].includes(ext)) return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'Word';
  if (['xls', 'xlsx'].includes(ext)) return 'Excel';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archive';
  return 'File';
}

// Main component
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

  // Inline edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingFeedback, setEditingFeedback] = useState<{ note: Note; image?: any; comment: string } | null>(null);
  const [uploadingFeedbackImage, setUploadingFeedbackImage] = useState(false);

  // Project details
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);

  // Timer state
  const [timerInfo, setTimerInfo] = useState<{
    status: 'AVAILABLE' | 'RUNNING' | 'WARNING' | 'EXCEEDED' | 'USED' | 'APPROVED';
    elapsed_minutes?: number;
    is_rework?: boolean;
  } | null>(null);

  // ---- Fetch logic ----
  useEffect(() => {
    if (!taskId) return;
    let ignore = false;

    const fetchTaskAndNotes = async () => {
      try {
        // Fetch task details
        const taskRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/detail`);
        if (!taskRes.ok) throw new Error('Failed to fetch task');
        const taskData = await taskRes.json();
        if (ignore) return;
        setTask(taskData.task);

        // Fetch project details
        if (taskData.task && taskData.task.project_id) {
          try {
            const projRes = await fetch(`/api/projects/${encodeURIComponent(taskData.task.project_id)}`);
            if (projRes.ok) {
              const projData = await projRes.json();
              if (ignore) return;
              setProjectDetails(projData.project || null);
            } else {
              setProjectDetails(null);
            }
          } catch {
            setProjectDetails(null);
          }
        } else {
          setProjectDetails(null);
        }

        // Fetch all notes
        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (!notesRes.ok) throw new Error('Failed to fetch notes');
        const notesData = await notesRes.json();
        if (ignore) return;
        setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
      } catch (err) {
        if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== 'production') console.error(err);
        setTask(null);
        setProjectDetails(null);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskAndNotes();

    // Fetch timer info
    const fetchTimerInfo = async () => {
      try {
        const res = await fetch(`/api/timers/${taskId}/current`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setTimerInfo({
              status: data.status,
              elapsed_minutes: data.timer?.elapsed_minutes || 0,
              is_rework: data.timer?.is_rework,
            });
          }
        }
      } catch (err) {
        if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== 'production') console.error('Failed to fetch timer info:', err);
      }
    };

    fetchTimerInfo();

    return () => {
      ignore = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
    }
  }, [task]);

  // ---- Editing Handlers ----
  const handleSaveTitle = async () => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, title: editTitle.trim() } : null));
        setIsEditingTitle(false);
      } else {
        let data: { error?: string } = {};
        try {
          data = await res.json();
        } catch {}
        alert(data.error || 'Failed to update title');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/tasks/${task?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription }),
      });
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, description: editDescription } : null));
        setIsEditingDescription(false);
      } else {
        let data: { error?: string } = {};
        try {
          data = await res.json();
        } catch {}
        alert(data.error || 'Failed to update description');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !session?.user) return;
    setNoteLoading(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          note: newNote,
          note_type: 'COMMENT',
        }),
      });
      if (res.ok) {
        setNewNote('');
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
        } catch {}
        alert(errorMsg);
      }
    } catch {
      alert('Network error');
    } finally {
      setNoteLoading(false);
    }
  };

  // ---- Feedback handlers ----
  function getFeedbackMeta(note: Note): any | undefined {
    if (note && note.note_type === 'FEEDBACK_IMAGE') {
      let metaRaw: any = undefined;
      if (note.metadata) metaRaw = note.metadata;
      if (!metaRaw) return undefined;
      try {
        if (typeof metaRaw === 'string') return JSON.parse(metaRaw);
        return metaRaw;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  function handleEditFeedback(note: Note) {
    try {
      const meta = getFeedbackMeta(note);
      setEditingFeedback({
        note,
        image: meta?.image || null,
        comment: note.note,
      });
    } catch {
      setEditingFeedback({
        note,
        image: null,
        comment: note.note,
      });
    }
  }

  const handleSaveFeedbackEdit = async () => {
    if (!editingFeedback) return;
    try {
      const updateData: Record<string, any> = {
        note: editingFeedback.comment,
      };
      if (editingFeedback.image) {
        updateData.metadata = JSON.stringify({
          image: editingFeedback.image,
        });
      } else {
        updateData.metadata = JSON.stringify({});
      }
      const res = await fetch(`/api/notes/${editingFeedback.note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (res.ok) {
        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
        }
        setEditingFeedback(null);
      } else {
        let data: { error?: string } = {};
        try {
          data = await res.json();
        } catch {}
        alert(data.error || 'Failed to update feedback');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleFeedbackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !editingFeedback) return;
    setUploadingFeedbackImage(true);
    try {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setEditingFeedback((prev) =>
          prev
            ? {
                ...prev,
                image: {
                  url: data.url,
                  public_id: data.public_id,
                  original_name: data.original_name,
                  format: data.format,
                  bytes: data.bytes,
                },
              }
            : null
        );
      }
    } catch {
      alert('Failed to upload image');
    } finally {
      setUploadingFeedbackImage(false);
    }
  };

  const handleRemoveFeedbackImage = () => {
    if (editingFeedback) {
      setEditingFeedback({
        ...editingFeedback,
        image: null,
      });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600 dark:text-gray-400">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-2xl mb-2">❌</div>
            <p className="text-gray-800 dark:text-gray-200 font-medium">Task not found</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main Render ----
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-label="Close sidebar overlay"
        tabIndex={-1}
        role="button"
      />
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 relative z-50 overflow-y-auto max-h-screen">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold"
          aria-label="Close details"
          type="button"
        >
          &times;
        </button>

        {/* Project Info */}
        <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{task.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{task.description || 'No description'}</p>
          
          {projectDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Project Details</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Name</span>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">{projectDetails.name}</p>
                </div>
                {projectDetails.client_name && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Client</span>
                    <p className="text-gray-900 dark:text-gray-100">{projectDetails.client_name}</p>
                  </div>
                )}
                {projectDetails.website_url && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Website</span>
                    <a
                      href={projectDetails.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline block"
                    >
                      {projectDetails.website_url}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Task Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assigned To</h3>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{task.assigned_to_name}</p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assigned By</h3>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{task.assigned_by_name}</p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priority</h3>
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              task.priority === 'HIGH'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                : task.priority === 'MEDIUM'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
            }`}>
              {task.priority}
            </span>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</h3>
            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full">
              {task.status}
            </span>
          </div>
        </div>

        {/* Edit Task Button */}
        {(session?.user?.role === 'ADMIN' ||
          (!!task.assigned_by_id && session?.user?.id === task.assigned_by_id)) && (
            <div className="mb-6">
              <button
                onClick={() => {
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
                      files: task.files ?? [],
                    },
                  });
                  window.dispatchEvent(event);
                }}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                type="button"
              >
                Edit Task
              </button>
            </div>
          )}

        {/* ✅ QA Feedback Button - FIXED FOR NEW WORKFLOW */}
        {session?.user?.role === 'QA' &&
          task.qa_assigned_to === session?.user?.id && (
            <div className="mb-6">
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('qa-feedback', {
                      detail: {
                        taskId: task.id,
                        taskTitle: task.title,
                        taskDescription: task.description,
                      },
                    })
                  );
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                type="button"
              >
                📝 Give Feedback
              </button>
            </div>
          )}

        {/* Help Button - Only for non-admin users */}
        {!['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'QA'].includes(session?.user?.role || '') && (
          <div className="mb-6">
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/help-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: task.id }),
                  });
                  if (res.ok) {
                    alert('✅ Help request sent! Admin, Project Managers, and Team Leaders have been notified.');
                  } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to send help request');
                  }
                } catch (err) {
                  alert('Network error');
                }
              }}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              type="button"
            >
              🆘 Request Help
            </button>
          </div>
        )}

        {/* Enhanced Timer Controls Section */}
        {task.status !== 'APPROVED' &&
          task.assigned_to === session?.user?.id &&
          timerInfo?.status !== 'USED' && (
            <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time Tracking
              </h3>
              
              {/* Timer Status Display */}
              {timerInfo?.status === 'RUNNING' && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-sm font-medium text-green-700 dark:text-green-300">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Timer Running
                    </div>
                    {timerInfo.is_rework && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full">
                        🔄 Rework
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {Math.floor((timerInfo.elapsed_minutes || 0) / 60)}h {(timerInfo.elapsed_minutes || 0) % 60}m
                  </div>
                  {task.estimated_minutes && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Estimated: {task.estimated_minutes} minutes
                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              ((timerInfo?.elapsed_minutes || 0) / (task.estimated_minutes || 1)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {timerInfo?.status === 'WARNING' && (
                <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                      ⚠️ Approaching Limit
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {Math.floor((timerInfo.elapsed_minutes || 0) / 60)}h {(timerInfo.elapsed_minutes || 0) % 60}m
                  </div>
                  {task.estimated_minutes && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Estimated: {task.estimated_minutes} minutes
                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              ((timerInfo?.elapsed_minutes || 0) / (task.estimated_minutes || 1)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {timerInfo?.status === 'EXCEEDED' && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-sm font-medium text-red-700 dark:text-red-300">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-ping"></div>
                      ⏰ Time Exceeded!
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {Math.floor((timerInfo.elapsed_minutes || 0) / 60)}h {(timerInfo.elapsed_minutes || 0) % 60}m
                  </div>
                  {task.estimated_minutes && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Estimated: {task.estimated_minutes} minutes
                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              ((timerInfo?.elapsed_minutes || 0) / (task.estimated_minutes || 1)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-800 dark:text-red-200">
                    <strong>⚠️ Notifications sent to:</strong>
                    <ul className="mt-1 ml-4 list-disc">
                      <li>Team Leaders</li>
                      <li>Project Managers</li>
                      <li>Administrators</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Timer Control Buttons */}
              <div className="flex space-x-2">
                {timerInfo?.status === 'AVAILABLE' ? (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/timers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ task_id: task.id }),
                        });
                        if (res.ok) {
                          const timerRes = await fetch(`/api/timers/${task.id}/current`);
                          if (timerRes.ok) {
                            const data = await timerRes.json();
                            setTimerInfo({
                              status: data.status,
                              elapsed_minutes: data.timer?.elapsed_minutes || 0,
                              is_rework: data.timer?.is_rework,
                            });
                          }
                        } else {
                          const data = await res.json();
                          alert(data.error || 'Failed to start timer');
                        }
                      } catch {
                        alert('Network error');
                      }
                    }}
                    className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center justify-center"
                    type="button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Timer
                  </button>
                ) : (timerInfo?.status === 'RUNNING' || timerInfo?.status === 'WARNING' || timerInfo?.status === 'EXCEEDED') ? (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/timers/${task.id}/stop`, { method: 'POST' });
                        if (res.ok) {
                          const data = await res.json();
                          const minutes = Math.floor(data.duration_seconds / 60);
                          const seconds = data.duration_seconds % 60;
                          if (data.timeExceeded) {
                            alert(
                              `⚠️ Timer stopped!
Duration: ${minutes}m ${seconds}s
Estimated: ${data.estimated_minutes} minutes
⏰ TIME LIMIT EXCEEDED!
Notifications have been sent to:
• Team Leaders
• Project Managers
• Administrators`
                            );
                          } else {
                            alert(`✅ Timer stopped!
Duration: ${minutes}m ${seconds}s`);
                          }
                          setTimerInfo({ status: 'USED' });
                        } else {
                          const data = await res.json();
                          alert(data.error || 'Failed to stop timer');
                        }
                      } catch {
                        alert('Network error');
                      }
                    }}
                    className={`flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium shadow-sm flex items-center justify-center ${
                      timerInfo?.status === 'EXCEEDED'
                        ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                        : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                    type="button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop Timer
                  </button>
                ) : null}
              </div>
              
              {/* Timer Used Message */}
              {timerInfo?.status === 'APPROVED' && (
                <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400 italic">
                  ✓ Timer has been completed for this task
                </p>
              )}
              
              {/* Estimated Time Info */}
              {task.estimated_minutes && timerInfo?.status === 'AVAILABLE' && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <strong>Estimated time:</strong> {task.estimated_minutes} minutes
                </div>
              )}
            </div>
          )}

        {/* Attachments */}
        {task.files && Array.isArray(task.files) && task.files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white mb-3">
              Attachments ({task.files.length})
            </h3>
            <div className="space-y-2">
              {task.files.map((file, index) => {
                if (!file || typeof file !== 'object' || typeof file.url !== 'string' || typeof file.resource_type !== 'string')
                  return null;
                const isImage = file.resource_type === 'image';
                return (
                  <div key={file.public_id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start space-x-3">
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                            {getFileTypeLabel(file.original_name || `File ${index + 1}`)}
                          </span>
                          {typeof file.bytes === 'number' && !isNaN(file.bytes) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.bytes / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                        <p
                          className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1 truncate"
                          title={file.original_name || `File ${index + 1}`}
                        >
                          {file.original_name || `File ${index + 1}`}
                        </p>
                        {isImage && (
                          <img
                            src={file.url}
                            alt={file.original_name || `Attachment ${index + 1}`}
                            className="mt-2 w-full rounded border border-gray-300 dark:border-gray-600"
                            style={{ maxHeight: '200px' }}
                          />
                        )}
                        <a
                          href={`/api/download?public_id=${encodeURIComponent(file.public_id || '')}&resource_type=${encodeURIComponent(
                            file.resource_type || ''
                          )}&filename=${encodeURIComponent(file.original_name || `File ${index + 1}`)}`}
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

        {/* Activity Feed */}
        <div>
          <h3 className="text-sm font-medium text-gray-800 dark:text-white mb-3">Activity</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Array.isArray(notes) && notes.length > 0 ? (
              notes.map((note) => {
                const isOwnFeedback =
                  note.note_type === 'FEEDBACK_IMAGE' &&
                  session?.user?.id === note.user_id &&
                  session?.user?.role === 'QA';
                return (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg ${
                      note.note_type === 'APPROVAL'
                        ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500'
                        : note.note_type === 'REJECTION'
                        ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                        : note.note_type === 'FEEDBACK_IMAGE'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    {note.note_type !== 'FEEDBACK_IMAGE' && (
                      <p className="text-sm text-gray-800 dark:text-gray-200">{note.note}</p>
                    )}
                    {note.note_type === 'FEEDBACK_IMAGE' && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{note.note}</p>
                        {(() => {
                          const meta = getFeedbackMeta(note);
                          if (meta && meta.image && meta.image.url) {
                            let imageUrl = meta.image.url;
                            if (
                              typeof imageUrl === 'string' &&
                              !imageUrl.startsWith('http') &&
                              meta.image.public_id &&
                              typeof process !== 'undefined' &&
                              typeof process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME === 'string' &&
                              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
                            ) {
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
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback = document.createElement('div');
                                        fallback.className =
                                          'bg-gray-200 dark:bg-gray-700 p-4 rounded text-center text-sm text-gray-600 dark:text-gray-400';
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
                                {isOwnFeedback && (
                                  <button
                                    onClick={() => handleEditFeedback(note)}
                                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    type="button"
                                  >
                                    Edit Feedback
                                  </button>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded text-center text-sm text-gray-600 dark:text-gray-400">
                              <p>No image data available</p>
                              {isOwnFeedback && (
                                <button
                                  onClick={() => handleEditFeedback(note)}
                                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  type="button"
                                >
                                  Edit Feedback
                                </button>
                              )}
                            </div>
                          );
                        })()}
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
                );
              })
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet</p>
            )}
          </div>
          
          <div className="mt-3 flex">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              aria-label="Add a comment"
              onKeyDown={(e) => {
                if (
                  (e.key === 'Enter' ||
                    (typeof (e as any).keyCode === 'number' ? (e as any).keyCode === 13 : false)) &&
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
              className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              type="button"
            >
              {noteLoading ? 'Adding...' : 'Comment'}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Edit Modal */}
      {editingFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Edit Feedback</h2>
            {editingFeedback.image && (
              <div className="mb-4">
                <img
                  src={editingFeedback.image.url}
                  alt="Current feedback"
                  className="w-full h-32 object-cover rounded border border-gray-300 dark:border-gray-600 mb-2"
                />
                <button
                  type="button"
                  onClick={handleRemoveFeedbackImage}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove Image
                </button>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Replace Image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFeedbackImageUpload}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={uploadingFeedbackImage}
              />
              {uploadingFeedbackImage && <p className="text-sm text-gray-600 mt-1">Uploading...</p>}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Comment
              </label>
              <textarea
                value={editingFeedback.comment}
                onChange={(e) =>
                  setEditingFeedback((prev) =>
                    prev ? { ...prev, comment: e.target.value } : null
                  )
                }
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditingFeedback(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFeedbackEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}