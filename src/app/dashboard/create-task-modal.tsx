// src/app/dashboard/create-task-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

export default function CreateTaskModal({
  projects,
  teamMembers,
  onClose,
}: {
  projects: { id: string; name: string }[];
  teamMembers: User[];
  onClose: () => void;
}) {
  const { data: session } = useSession();

  // Get active project ID from URL
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const projectId = url.searchParams.get('project');
    setActiveProjectId(projectId);
  }, []);

  // Initialize form with active project if exists - FIXED: Set project_id in formData
  const [formData, setFormData] = useState({
    project_id: '',
    team_type: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as const,
    assigned_to: '',
    qa_assigned_to: '',
    estimated_minutes: '',
  });

  // FIXED: Update formData when activeProjectId changes
  useEffect(() => {
    if (activeProjectId) {
      setFormData(prev => ({
        ...prev,
        project_id: activeProjectId
      }));
    }
  }, [activeProjectId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // Upload files
  const uploadFiles = async () => {
    if (files.length === 0) return [];

    setUploading(true);
    const uploadedUrls: any[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedUrls.push(data);
        } else {
          console.error('Failed to upload file:', file.name);
        }
      }
      return uploadedUrls;
    } catch (err) {
      console.error('Upload error:', err);
      return uploadedUrls;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // FIXED: Add validation before submission
    if (!formData.project_id || formData.project_id.trim() === '') {
      setError('Please select a project');
      setLoading(false);
      return;
    }

    console.log('Submitting form with project_id:', formData.project_id); // Debug log

    try {
      // Upload files first
      const fileUrls = await uploadFiles();

      const payload = {
        ...formData,
        files: fileUrls,
        estimated_minutes: formData.estimated_minutes
          ? parseInt(formData.estimated_minutes)
          : null,
      };

      console.log('Task payload:', payload); // Debug log

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Refresh tasks list
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
        onClose();
      } else {
        const contentType = res.headers.get('content-type');
        let errorMessage = 'Failed to create task';
        
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
          
          // Show detailed error if available
          if (data.details) {
            console.error('Validation errors:', data.details);
            errorMessage += ': ' + Object.entries(data.details)
              .filter(([_, v]) => v !== 'ok')
              .map(([k, v]) => `${k} - ${v}`)
              .join(', ');
          }
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const qas = teamMembers.filter((user) => user.role === 'QA');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Create New Task</h2>
        {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* FIXED: Project field - always update formData */}
          {activeProjectId ? (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Project
              </label>
              <input
                type="text"
                value={projects.find(p => p.id === activeProjectId)?.name || 'Selected Project'}
                disabled
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
              />
              {/* Debug: Show actual project_id value */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Project ID: {formData.project_id || '(not set)'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Project
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => {
                  console.log('Project selected:', e.target.value); // Debug log
                  setFormData({ ...formData, project_id: e.target.value });
                }}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Project</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Team Type
            </label>
            <select
              value={formData.team_type}
              onChange={(e) =>
                setFormData({ ...formData, team_type: e.target.value, assigned_to: '' })
              }
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Team</option>
              {Array.from(new Set(teamMembers.map((u) => u.team_type))).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {formData.team_type && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Assign To
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Member</option>
                {teamMembers
                  .filter((u) => u.team_type === formData.team_type)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.username})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {qas.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                QA Reviewer (Optional)
              </label>
              <select
                value={formData.qa_assigned_to}
                onChange={(e) =>
                  setFormData({ ...formData, qa_assigned_to: e.target.value })
                }
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No QA</option>
                {qas.map((qa) => (
                  <option key={qa.id} value={qa.id}>
                    {qa.name} ({qa.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Attachments
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={uploading}
            />
            {files.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {files.length} file(s) selected
              </p>
            )}
            {uploading && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Uploading files...
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Est. Minutes
              </label>
              <input
                type="number"
                value={formData.estimated_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, estimated_minutes: e.target.value })
                }
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : uploading ? 'Uploading...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}