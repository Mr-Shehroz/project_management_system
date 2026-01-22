// src/app/dashboard/create-task-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string; // ← add role
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

  // Initialize form with active project if exists
  const [formData, setFormData] = useState({
    project_id: activeProjectId || '',
    team_type: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as const,
    assigned_to: '',
    qa_assigned_to: '',
    estimated_minutes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Add state for files
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // Upload files to Vercel Blob
  const uploadFiles = async () => {
    if (files.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

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
          uploadedUrls.push(data.url);
        }
      }
      return uploadedUrls;
    } finally {
      setUploading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Upload files first
      const fileUrls = await uploadFiles();

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          files: fileUrls, // ← Add file URLs
          estimated_minutes: formData.estimated_minutes
            ? parseInt(formData.estimated_minutes)
            : null,
        }),
      });

      if (res.ok) {
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create task');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const qas = teamMembers.filter((user) => user.role === 'QA');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create New Task</h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project field: show dropdown OR auto-filled */}
          {activeProjectId ? (
            // Auto-filled project (no dropdown)
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <input
                type="text"
                value={projects.find(p => p.id === activeProjectId)?.name || 'Selected Project'}
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              />
              <input
                type="hidden"
                name="project_id"
                value={activeProjectId}
              />
            </div>
          ) : (
            // Show project dropdown
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                required
                className="w-full border rounded px-3 py-2"
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

          {/* Rest of the form remains the same */}
          <div>
            <label className="block text-sm font-medium mb-1">Team Type</label>
            <select
              value={formData.team_type}
              onChange={(e) =>
                setFormData({ ...formData, team_type: e.target.value, assigned_to: '' })
              }
              required
              className="w-full border rounded px-3 py-2"
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
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                required
                className="w-full border rounded px-3 py-2"
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
              <label className="block text-sm font-medium mb-1">QA Reviewer (Optional)</label>
              <select
                value={formData.qa_assigned_to}
                onChange={(e) =>
                  setFormData({ ...formData, qa_assigned_to: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-1">Attachments</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            />
            {files.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {files.length} file(s) selected
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Est. Minutes</label>
              <input
                type="number"
                value={formData.estimated_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, estimated_minutes: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}