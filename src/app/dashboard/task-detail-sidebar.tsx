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
  assigned_by_id?: string;
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
  note_type: string;
  created_at: string;
  metadata?: any;
};

type FeedbackItem = {
  id: string;
  image?: {
    url: string;
    public_id: string;
    original_name: string;
    format: string;
    bytes: number;
  };
  note: string;
};

const getFileIcon = (filename: string) => {
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
};

const getFileTypeLabel = (filename: string) => {
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

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingFeedback, setEditingFeedback] = useState<{ note: Note; image?: any; comment: string } | null>(null);
  const [uploadingFeedbackImage, setUploadingFeedbackImage] = useState(false);

  // QA Feedback State
  const [showQAFeedback, setShowQAFeedback] = useState(false);
  const [qaFeedbackItems, setQAFeedbackItems] = useState<FeedbackItem[]>([]);
  const [qaOverallNote, setQAOverallNote] = useState('');
  const [qaStatus, setQAStatus] = useState<'APPROVED' | 'REWORK'>('APPROVED');
  const [uploadingQAImages, setUploadingQAImages] = useState(false);
  const [submittingQAFeedback, setSubmittingQAFeedback] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const fetchTaskAndNotes = async () => {
      try {
        const taskRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/detail`);
        if (!taskRes.ok) throw new Error('Failed to fetch task');
        const taskData = await taskRes.json();
        setTask(taskData.task);

        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (!notesRes.ok) throw new Error('Failed to fetch notes');
        const notesData = await notesRes.json();
        setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error(err);
        setTask(null);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskAndNotes();
  }, [taskId]);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
    }
  }, [task]);

  const handleSaveTitle = async () => {
    if (editTitle.trim() === '') {
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
        setTask(prev => prev ? { ...prev, title: editTitle.trim() } : null);
        setIsEditingTitle(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update title');
      }
    } catch (err) {
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
        setTask(prev => prev ? { ...prev, description: editDescription } : null);
        setIsEditingDescription(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update description');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !session) return;

    setNoteLoading(true);
    try {
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
        alert(errorMsg);
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setNoteLoading(false);
    }
  };

  const getFeedbackMeta = (note: Note): any | undefined => {
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
  };

  const handleEditFeedback = (note: Note) => {
    try {
      const meta = getFeedbackMeta(note);
      setEditingFeedback({
        note,
        image: meta?.image || null,
        comment: note.note
      });
    } catch (e) {
      setEditingFeedback({
        note,
        image: null,
        comment: note.note
      });
    }
  };

  const handleSaveFeedbackEdit = async () => {
    if (!editingFeedback) return;

    try {
      const updateData: any = {
        note: editingFeedback.comment
      };

      if (editingFeedback.image) {
        updateData.metadata = JSON.stringify({
          image: editingFeedback.image
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
        const data = await res.json();
        alert(data.error || 'Failed to update feedback');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleFeedbackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !editingFeedback) return;

    setUploadingFeedbackImage(true);
    try {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEditingFeedback(prev => prev ? {
          ...prev,
          image: {
            url: data.url,
            public_id: data.public_id,
            original_name: data.original_name,
            format: data.format,
            bytes: data.bytes
          }
        } : null);
      }
    } catch (err) {
      alert('Failed to upload image');
    } finally {
      setUploadingFeedbackImage(false);
    }
  };

  const handleRemoveFeedbackImage = () => {
    if (editingFeedback) {
      setEditingFeedback({
        ...editingFeedback,
        image: null
      });
    }
  };

  // QA Feedback Functions
  const handleQAImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setUploadingQAImages(true);
    try {
      const newFeedbackItems: FeedbackItem[] = [];

      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newFeedbackItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            image: {
              url: data.url,
              public_id: data.public_id,
              original_name: data.original_name,
              format: data.format,
              bytes: data.bytes
            },
            note: ''
          });
        }
      }

      setQAFeedbackItems(prev => [...prev, ...newFeedbackItems]);
    } catch (err) {
      alert('Failed to upload images');
    } finally {
      setUploadingQAImages(false);
    }
  };

  const handleQAPaste = async (e: React.ClipboardEvent) => {
    if (!e.clipboardData || !e.clipboardData.items) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault();

    setUploadingQAImages(true);
    try {
      const newFeedbackItems: FeedbackItem[] = [];

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newFeedbackItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            image: {
              url: data.url,
              public_id: data.public_id,
              original_name: data.original_name,
              format: data.format,
              bytes: data.bytes
            },
            note: ''
          });
        }
      }

      setQAFeedbackItems(prev => [...prev, ...newFeedbackItems]);
    } catch (err) {
      alert('Failed to upload pasted images');
    } finally {
      setUploadingQAImages(false);
    }
  };

  const updateQAFeedbackNote = (id: string, note: string) => {
    setQAFeedbackItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, note } : item
      )
    );
  };

  const removeQAFeedbackItem = (id: string) => {
    setQAFeedbackItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmitQAFeedback = async () => {
    setSubmittingQAFeedback(true);

    try {
      const feedback = qaFeedbackItems.map(item => ({
        image: item.image ? {
          url: item.image.url,
          public_id: item.image.public_id,
          original_name: item.image.original_name,
          format: item.image.format,
          bytes: item.image.bytes
        } : undefined,
        note: item.note
      }));

      const res = await fetch('/api/notes/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task_id: taskId, 
          note: qaOverallNote, 
          status: qaStatus, 
          feedback 
        }),
      });

      if (res.ok) {
        const notesRes = await fetch(`/api/notes?task_id=${encodeURIComponent(taskId)}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
        }
        
        setShowQAFeedback(false);
        setQAFeedbackItems([]);
        setQAOverallNote('');
        setQAStatus('APPROVED');
        
        const taskRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/detail`);
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          setTask(taskData.task);
        }
        
        alert('QA feedback submitted successfully!');
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit QA feedback');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSubmittingQAFeedback(false);
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

  const isEditable =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'PROJECT_MANAGER' ||
    session?.user?.role === 'TEAM_LEADER';

  const isQAUser = session?.user?.role === 'QA';
  const canProvideQAFeedback = isQAUser && task.status === 'WAITING_FOR_QA';

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

        {/* QA Feedback Button */}
        {canProvideQAFeedback && !showQAFeedback && (
          <button
            onClick={() => setShowQAFeedback(true)}
            className="w-full mb-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span>📝</span>
            <span>Provide QA Feedback</span>
          </button>
        )}

        {/* QA Feedback Form */}
        {canProvideQAFeedback && showQAFeedback && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" onPaste={handleQAPaste}>
            <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-3">QA Feedback</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="qa-status"
                      checked={qaStatus === 'APPROVED'}
                      onChange={() => setQAStatus('APPROVED')}
                      className="text-blue-600 w-4 h-4"
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">✅ Approve</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="qa-status"
                      checked={qaStatus === 'REWORK'}
                      onChange={() => setQAStatus('REWORK')}
                      className="text-red-600 w-4 h-4"
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">🔄 Rework</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Overall Notes</label>
                <textarea
                  value={qaOverallNote}
                  onChange={(e) => setQAOverallNote(e.target.value)}
                  placeholder="Provide overall feedback..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  📎 Add Reference Images (paste or upload)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleQAImageUpload}
                  accept="image/*"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  disabled={uploadingQAImages}
                />
                {uploadingQAImages && <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">📤 Uploading images...</p>}

                {qaFeedbackItems.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {qaFeedbackItems.map((item, index) => (
                      <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700">
                        {item.image && (
                          <div className="mb-2">
                            <img
                              src={item.image.url}
                              alt={`Feedback ${index + 1}`}
                              className="w-full h-40 object-cover rounded border border-gray-300 dark:border-gray-600"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {item.image.original_name} • {(item.image.bytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        )}
                        <textarea
                          value={item.note}
                          onChange={(e) => updateQAFeedbackNote(item.id, e.target.value)}
                          placeholder={`💬 Add comment for image ${index + 1}...`}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={() => removeQAFeedbackItem(item.id)}
                          className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQAFeedback(false);
                    setQAFeedbackItems([]);
                    setQAOverallNote('');
                    setQAStatus('APPROVED');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitQAFeedback}
                  disabled={submittingQAFeedback}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {submittingQAFeedback ? '⏳ Submitting...' : '✅ Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Title - Inline Edit */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</h3>
            {isEditingTitle ? (
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      setEditTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setEditTitle(task.title);
                    setIsEditingTitle(false);
                  }}
                  className="px-2 py-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onDoubleClick={() => {
                  if (isEditable) {
                    setIsEditingTitle(true);
                  }
                }}
                className={`mt-1 text-gray-800 dark:text-gray-200 ${isEditable
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 cursor-text'
                  : 'cursor-default'
                  }`}
              >
                {task.title}
              </div>
            )}
          </div>

          {/* Description - Inline Edit */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
            {isEditingDescription ? (
              <div className="flex items-start space-x-2 mt-1">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onBlur={handleSaveDescription}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveDescription();
                    } else if (e.key === 'Escape') {
                      setEditDescription(task.description || '');
                      setIsEditingDescription(false);
                    }
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                  autoFocus
                />
                <button
                  onClick={() => {
                    setEditDescription(task.description || '');
                    setIsEditingDescription(false);
                  }}
                  className="px-2 py-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onDoubleClick={() => {
                  if (isEditable) {
                    setIsEditingDescription(true);
                  }
                }}
                className={`mt-1 text-gray-800 dark:text-gray-200 ${isEditable
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-1 cursor-text'
                  : 'cursor-default'
                  }`}
              >
                {task.description && typeof task.description === 'string' && task.description.trim()
                  ? task.description
                  : 'No description'}
              </div>
            )}
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

          {(session?.user?.role === 'ADMIN' ||
            (!!task.assigned_by_id && session?.user?.id === task.assigned_by_id)) && (
              <div className="mt-4">
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
                        files: task.files ?? []
                      }
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                  type="button"
                >
                  ✏️ Edit Task
                </button>
              </div>
            )}

          {/* Attachments */}
          {task.files && Array.isArray(task.files) && task.files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-800 dark:text-white mb-3">
                📎 Attachments ({task.files.length})
              </h3>
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
                  const isRaw = file.resource_type === 'raw';

                  const downloadUrl = isRaw
                    ? (file.url?.replace('/upload/', '/upload/fl_attachment/') || file.url)
                    : file.url;

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
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {getFileTypeLabel(file.original_name || `File ${index + 1}`)}
                            </span>
                            {typeof file.bytes === "number" && !isNaN(file.bytes) && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.bytes / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1 truncate" title={file.original_name || `File ${index + 1}`}>
                            {file.original_name || `File ${index + 1}`}
                          </p>
                          {isImage && (
                            <img
                              src={file.url}
                              alt={file.original_name || `Attachment ${index + 1}`}
                              className="mt-2 w-full rounded border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90"
                              style={{ maxHeight: '200px', objectFit: 'contain' }}
                              onClick={() => window.open(file.url, '_blank')}
                            />
                          )}
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
                notes.map((note) => {
                  // Check if this is QA's own feedback
                  const isOwnFeedback = note.note_type === 'FEEDBACK_IMAGE' &&
                    session?.user?.id === note.user_id &&
                    session?.user?.role === 'QA';

                  return (
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

                      {/* Feedback Image */}
                      {note.note_type === 'FEEDBACK_IMAGE' && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{note.note}</p>
                          {/* Only render if metadata has image, LINT SAFE */}
                          {(() => {
                            const meta = getFeedbackMeta(note);
                            if (meta && meta.image && meta.image.url) {
                              let imageUrl = meta.image.url;
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
                                  {/* Edit button for QA's own feedback */}
                                  {isOwnFeedback && (
                                    <button
                                      onClick={() => handleEditFeedback(note)}
                                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      Edit Feedback
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            // No image object in metadata
                            return (
                              <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded text-center text-sm text-gray-600 dark:text-gray-400">
                                <p>No image data available</p>
                                {isOwnFeedback && (
                                  <button
                                    onClick={() => handleEditFeedback(note)}
                                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l px-3 py-1 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                aria-label="Add a comment"
                onKeyDown={e => {
                  if (
                    (e.key === 'Enter' || (e as any).keyCode === 13) &&
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
      {/* Feedback Edit Modal */}
      {editingFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Edit Feedback</h2>

            {/* Current Image Preview */}
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

            {/* Upload New Image */}
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

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Comment
              </label>
              <textarea
                value={editingFeedback.comment}
                onChange={(e) => setEditingFeedback({ ...editingFeedback, comment: e.target.value })}
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