'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Loader2, X, ClipboardList } from 'lucide-react';

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

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const projectId = url.searchParams.get('project');
    setActiveProjectId(projectId);
  }, []);

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

  useEffect(() => {
    if (activeProjectId) {
      setFormData((prev) => ({
        ...prev,
        project_id: activeProjectId,
      }));
    }
  }, [activeProjectId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return [];

    setUploading(true);
    const uploadedUrls: any[] = [];

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedUrls.push(data);
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

    if (!formData.project_id) {
      setError('Please select a project');
      setLoading(false);
      return;
    }

    try {
      const fileUrls = await uploadFiles();

      const payload = {
        ...formData,
        files: fileUrls,
        estimated_minutes: formData.estimated_minutes
          ? parseInt(formData.estimated_minutes)
          : null,
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Task created successfully!');
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create task');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const qas = teamMembers.filter((u) => u.role === 'QA');

  return (
    <>
      {/* Soft backdrop (no black) */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Create New Task
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto">
            {error && (
              <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 text-center">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project */}
              {activeProjectId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      projects.find((p) => p.id === activeProjectId)?.name ||
                      'Selected Project'
                    }
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={(e) =>
                      setFormData({ ...formData, project_id: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">Select Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Team Type
                </label>
                <select
                  value={formData.team_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      team_type: e.target.value,
                      assigned_to: '',
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option disabled value="">
                    Select Team
                  </option>
                  {Array.from(
                    new Set(teamMembers.map((u) => u.team_type))
                  )
                    .filter((type) => type && type.trim() !== "")
                    .map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                </select>
              </div>

              {formData.team_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assign To
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) =>
                      setFormData({ ...formData, assigned_to: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">Select Member</option>
                    {teamMembers
                      .filter((u) => u.team_type === formData.team_type)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.username})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachments
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
                {files.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {files.length} file(s) selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.estimated_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_minutes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading || uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploading ? 'Uploading...' : 'Creating...'}
                    </>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Tasks can be edited after creation
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
