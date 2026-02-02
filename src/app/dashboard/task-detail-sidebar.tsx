// src/app/dashboard/task-detail-sidebar.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

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
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [timerInfo, setTimerInfo] = useState<{
    status: 'AVAILABLE' | 'RUNNING' | 'WARNING' | 'EXCEEDED' | 'USED' | 'APPROVED';
    elapsed_minutes?: number;
    is_rework?: boolean;
  } | null>(null);

  // --- QA Assign Modal State (for "Assign QA" button) ---
  const [showQAAssignModal, setShowQAAssignModal] = useState<string | null>(null);

  // ---- Fetch logic ----
  useEffect(() => {
    if (!taskId) return;
    let ignore = false;

    const fetchTaskAndNotes = async () => {
      try {
        const taskRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/detail`);
        if (!taskRes.ok) throw new Error('Failed to fetch task');
        const taskData = await taskRes.json();
        if (ignore) return;
        setTask(taskData.task);

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
    return () => { ignore = true; };
  }, [taskId]);

  // Initialize edit states when task loads
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
    }
  }, [task]);

  // Handle Title Save
  const handleSaveTitle = async () => {
    if (!editTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${task?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (res.ok) {
        setTask(prev => prev ? { ...prev, title: editTitle.trim() } : null);
        setIsEditingTitle(false);
        toast.success('Title updated');
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        // Defensive: response may not be json if error
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        toast.error(data.error || 'Failed to update title');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // Handle Description Save
  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/tasks/${task?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription }),
      });

      if (res.ok) {
        setTask(prev => prev ? { ...prev, description: editDescription } : null);
        setIsEditingDescription(false);
        toast.success('Description updated');
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        toast.error(data.error || 'Failed to update description');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // Handle Cancel Title Edit
  const handleCancelTitleEdit = () => {
    setEditTitle(task?.title || '');
    setIsEditingTitle(false);
  };

  // Handle Cancel Description Edit
  const handleCancelDescriptionEdit = () => {
    setEditDescription(task?.description || '');
    setIsEditingDescription(false);
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
        } catch { }
        toast.error(errorMsg);
      }
    } catch {
      toast.error('Network error');
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
        toast.success('Feedback updated');
      } else {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        toast.error(data.error || 'Failed to update feedback');
      }
    } catch {
      toast.error('Network error');
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
      toast.error('Failed to upload image');
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
              type="button"
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
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close sidebar overlay"
        tabIndex={-1}
        role="button"
      ></div>
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 relative z-50 overflow-y-auto max-h-screen shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            aria-label="Close details"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title Section */}
          <div className="space-y-3">
            {/* Title */}
            <div>
              {isEditingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTitle}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-purple-700 transition-all"
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelTitleEdit}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDoubleClick={() => {
                    if (
                      session?.user?.role === 'ADMIN' ||
                      session?.user?.role === 'PROJECT_MANAGER' ||
                      session?.user?.role === 'TEAM_LEADER'
                    ) {
                      setIsEditingTitle(true);
                    }
                  }}
                  className={`text-xl font-bold text-gray-900 dark:text-white cursor-text leading-tight ${(session?.user?.role === 'ADMIN' ||
                    session?.user?.role === 'PROJECT_MANAGER' ||
                    session?.user?.role === 'TEAM_LEADER')
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors'
                    : ''
                    }`}
                >
                  {task.title}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    autoFocus
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDescription}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-purple-700 transition-all"
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelDescriptionEdit}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDoubleClick={() => {
                    if (
                      session?.user?.role === 'ADMIN' ||
                      session?.user?.role === 'PROJECT_MANAGER' ||
                      session?.user?.role === 'TEAM_LEADER'
                    ) {
                      setIsEditingDescription(true);
                    }
                  }}
                  className={`text-sm text-gray-600 dark:text-gray-400 cursor-text min-h-[60px] ${(session?.user?.role === 'ADMIN' ||
                    session?.user?.role === 'PROJECT_MANAGER' ||
                    session?.user?.role === 'TEAM_LEADER')
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors'
                    : ''
                    }`}
                >
                  {task.description || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            {/* Assigned To */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Assigned To</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                    {task.assigned_to_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{task.assigned_to_name}</span>
                </div>
              </div>
            </div>

            {/* Assigned By */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Assigned By</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{task.assigned_by_name}</div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  {task.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Priority</div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  task.priority === 'HIGH'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                    : task.priority === 'MEDIUM'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                }`}>
                  {task.priority}
                </span>
              </div>
            </div>

            {/* Project */}
            {projectDetails && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Project</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{projectDetails.name}</div>
                  {projectDetails.client_name && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{projectDetails.client_name}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Edit Task Button */}
            {(session?.user?.role === 'ADMIN' ||
              (!!task.assigned_by_id && session?.user?.id === task.assigned_by_id)) && (
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Task
                </button>
              )}

            {/* ✅ QA Feedback Button - Updated Logic */}
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
            {/* ✅ Assign QA Button - Show when task is WAITING_FOR_QA but no QA assigned */}
            {(session?.user?.role === 'ADMIN' ||
              session?.user?.role === 'PROJECT_MANAGER' ||
              session?.user?.role === 'TEAM_LEADER') &&
              task.status === 'WAITING_FOR_QA' &&
              !task.qa_assigned_to && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowQAAssignModal(task.id)}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    type="button"
                  >
                    👤 Assign QA Reviewer
                  </button>
                </div>
              )}

            {/* Help Button */}
            {!['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'QA'].includes(session?.user?.role || '') && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/help-request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ task_id: task.id }),
                    });
                    if (res.ok) {
                      toast.success('Help request sent! Admin, Project Managers, and Team Leaders have been notified.');
                    } else {
                      let data: any = {};
                      try {
                        data = await res.json();
                      } catch {
                        data = {};
                      }
                      toast.error(data.error || 'Failed to send help request');
                    }
                  } catch (err) {
                    toast.error('Network error');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Request Help
              </button>
            )}
          </div>

          {/* Timer Section */}
          {task.status !== 'APPROVED' &&
            task.assigned_to === session?.user?.id &&
            timerInfo?.status !== 'USED' && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Time Tracking</div>

              {/* Timer Status Display */}
              {(timerInfo?.status === 'RUNNING' || timerInfo?.status === 'WARNING' || timerInfo?.status === 'EXCEEDED') && (
                <div className={`mb-3 p-3 rounded-lg border ${timerInfo?.status === 'RUNNING' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                    timerInfo?.status === 'WARNING' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' :
                      'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      {timerInfo?.status === 'RUNNING' && (
                        <>
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                          Timer Running
                        </>
                      )}
                      {timerInfo?.status === 'WARNING' && (
                        <>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                          ⚠️ Approaching Limit
                        </>
                      )}
                      {timerInfo?.status === 'EXCEEDED' && (
                        <>
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-ping"></div>
                          ⏰ Time Exceeded!
                        </>
                      )}
                    </div>
                    {timerInfo.is_rework && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full">
                        🔄 Rework
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    {Math.floor((timerInfo?.elapsed_minutes || 0) / 60)}h {(timerInfo?.elapsed_minutes || 0) % 60}m
                  </div>
                  {task.estimated_minutes && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Estimated: {task.estimated_minutes} minutes
                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${timerInfo?.status === 'RUNNING' ? 'bg-green-500' :
                              timerInfo?.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
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

                  {/* Time exceeded notification */}
                  {timerInfo?.status === 'EXCEEDED' && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-800 dark:text-red-200">
                      <strong>⚠️ Notifications sent to:</strong>
                      <ul className="mt-1 ml-4 list-disc">
                        <li>Team Leaders</li>
                        <li>Project Managers</li>
                        <li>Administrators</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Timer Control Buttons - Only Stop button for auto-started timers */}
              {(timerInfo?.status === 'RUNNING' || timerInfo?.status === 'WARNING' || timerInfo?.status === 'EXCEEDED') && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/timers/${task.id}/stop`, { method: 'POST' });
                      if (res.ok) {
                        const data = await res.json();
                        const minutes = Math.floor(data.duration_seconds / 60);
                        const seconds = data.duration_seconds % 60;
                        if (data.timeExceeded) {
                          toast.error(
                            `Timer stopped! Duration: ${minutes}m ${seconds}s | Estimated: ${data.estimated_minutes} minutes | TIME LIMIT EXCEEDED!`,
                            {
                              duration: 6000,
                            }
                          );
                        } else {
                          toast.success(`Timer stopped! Duration: ${minutes}m ${seconds}s`);
                        }
                        setTimerInfo({ status: 'USED' });
                      } else {
                        let data: any = {};
                        try {
                          data = await res.json();
                        } catch {
                          data = {};
                        }
                        toast.error(data.error || 'Failed to stop timer');
                      }
                    } catch (err) {
                      toast.error('Network error');
                    }
                  }}
                  className={`w-full px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium shadow-sm flex items-center justify-center ${timerInfo?.status === 'EXCEEDED'
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
              )}

              {/* Timer Used Message */}
              {timerInfo?.status === 'APPROVED' && (
                <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400 italic">
                  ✓ Timer completed
                </p>
              )}


              {/* Estimated Time Info */}
              {task.estimated_minutes && timerInfo?.status === 'AVAILABLE' && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <strong>Estimated time:</strong> {task.estimated_minutes} minutes
                </div>
              )}
                  </div>
                </div>
              </div>
            )}

          {/* Attachments Section */}
          {task.files && Array.isArray(task.files) && task.files.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Attachments ({task.files.length})
                </h3>
              </div>
              <div className="space-y-2">
                {task.files.map((file, index) => {
                  if (
                    !file ||
                    typeof file !== 'object' ||
                    typeof file.url !== 'string' ||
                    typeof file.resource_type !== 'string'
                  )
                    return null;
                  const isImage = file.resource_type === 'image';
                  return (
                    <div
                      key={file.public_id || index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
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
                            href={`/api/download?public_id=${encodeURIComponent(
                              file.public_id || ''
                            )}&resource_type=${encodeURIComponent(
                              file.resource_type || ''
                            )}&filename=${encodeURIComponent(file.original_name || `File ${index + 1}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
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

          {/* Activity Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Activity</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
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
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Add a comment"
                onKeyDown={(e) => {
                  const key = (e as React.KeyboardEvent<HTMLInputElement>).key || '';
                  if (
                    (key === 'Enter' ||
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
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-sm font-medium transition-all shadow-sm hover:shadow-md"
                type="button"
              >
                {noteLoading ? 'Adding...' : 'Comment'}
              </button>
            </div>
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