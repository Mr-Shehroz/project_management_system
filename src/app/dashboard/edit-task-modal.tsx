// src/app/dashboard/edit-task-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, X, Pencil } from 'lucide-react';

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

type TaskFile = {
  url: string;
  public_id: string;
  resource_type: string;
  original_name: string;
  format: string;
  bytes: number;
};

type Task = {
  id: string;
  project_id: string;
  team_type: string;
  title: string;
  description: string | null;
  priority: string;
  assigned_to: string;
  qa_assigned_to: string | null;
  estimated_minutes: number | null;
  status: string;
  files?: TaskFile[];
};

export default function EditTaskModal({
  task,
  projects,
  teamMembers,
  onClose,
  onUpdated,
}: {
  task: Task;
  projects: { id: string; name: string }[];
  teamMembers: User[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState({
    project_id: task.project_id,
    team_type: task.team_type,
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    assigned_to: task.assigned_to,
    qa_assigned_to: task.qa_assigned_to || '',
    estimated_minutes: task.estimated_minutes?.toString() || '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<TaskFile[]>(task.files || []);
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get team members for current team type
  const teamMembersForType = teamMembers.filter((user) => user.team_type === formData.team_type);
  const qas = teamMembers.filter((user) => user.role === 'QA');

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // Remove existing file
  const removeExistingFile = (publicId: string) => {
    setExistingFiles(prev => prev.filter(f => f.public_id !== publicId));
    setRemovedFileIds(prev => [...prev, publicId]);
  };

  // Upload new files
  const uploadNewFiles = async () => {
    if (files.length === 0) return [];

    setUploading(true);
    const uploadedFiles: TaskFile[] = [];

    try {
      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedFiles.push({
            url: data.url,
            public_id: data.public_id,
            resource_type: data.resource_type,
            original_name: data.original_name,
            format: data.format,
            bytes: data.bytes
          });
        }
      }
      return uploadedFiles;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
  
    try {
      // Upload new files
      const newFiles = await uploadNewFiles();
      
      // Combine existing files (not removed) + new files
      const finalFiles = [
        ...existingFiles.filter(f => !removedFileIds.includes(f.public_id)),
        ...newFiles
      ];
  
      // Build update payload with only changed fields
      const updatePayload: any = {};
      
      // Only include fields that have changed
      if (formData.project_id !== task.project_id) {
        updatePayload.project_id = formData.project_id;
      }
      if (formData.team_type !== task.team_type) {
        updatePayload.team_type = formData.team_type;
      }
      if (formData.title !== task.title) {
        updatePayload.title = formData.title;
      }
      if (formData.description !== (task.description || '')) {
        updatePayload.description = formData.description;
      }
      if (formData.priority !== task.priority) {
        updatePayload.priority = formData.priority;
      }
      if (formData.assigned_to !== task.assigned_to) {
        updatePayload.assigned_to = formData.assigned_to;
      }
      if (formData.qa_assigned_to !== (task.qa_assigned_to || '')) {
        updatePayload.qa_assigned_to = formData.qa_assigned_to || null;
      }
      if (formData.estimated_minutes !== (task.estimated_minutes?.toString() || '')) {
        updatePayload.estimated_minutes = formData.estimated_minutes || null;
      }
      if (JSON.stringify(finalFiles) !== JSON.stringify(task.files || [])) {
        updatePayload.files = finalFiles;
      }
  
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
  
      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update task');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Only styling changes below - no functional changes
  return (
    <>
      {/* Soft backdrop (no black bg) */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
          style={{ 
            msOverflowStyle: 'none', 
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Edit Task
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
          <div className="p-6">
            {error && (
              <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 text-center">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project - EDITABLE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project *
                </label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Type - EDITABLE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Team Type *
                </label>
                <select
                  value={formData.team_type}
                  onChange={(e) => setFormData({ ...formData, team_type: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Team</option>
                  {Array.from(new Set(teamMembers.map((u) => u.team_type))).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign To *
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Member</option>
                  {teamMembersForType.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* QA Reviewer */}
              {qas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    QA Reviewer (Optional)
                  </label>
                  <select
                    value={formData.qa_assigned_to}
                    onChange={(e) =>
                      setFormData({ ...formData, qa_assigned_to: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Existing Files */}
              {existingFiles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-white mb-2">
                    Current Attachments ({existingFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {existingFiles.map((file, index) => {
                      const isImage = file.resource_type === 'image';
                      return (
                        <div key={file.public_id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {isImage ? (
                              <img
                                src={file.url}
                                alt={file.original_name}
                                className="w-12 h-12 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                                📎
                              </div>
                            )}
                            <span className="text-sm">{file.original_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExistingFile(file.public_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add New Files */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add New Attachments
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={uploading}
                />
                {files.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {files.length} new file(s) selected
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                    value={formData.estimated_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, estimated_minutes: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-lg flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Update Task'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Changes are saved immediately after update
            </p>
          </div>
        </div>
      </div>
    </>
  );
}