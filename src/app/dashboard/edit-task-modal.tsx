// src/app/dashboard/edit-task-modal.tsx
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

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          files: finalFiles,
          estimated_minutes: formData.estimated_minutes
            ? parseInt(formData.estimated_minutes)
            : null,
        }),
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Task</h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project - EDITABLE */}
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

          {/* Team Type - EDITABLE */}
          <div>
            <label className="block text-sm font-medium mb-1">Team Type</label>
            <select
              value={formData.team_type}
              onChange={(e) => setFormData({ ...formData, team_type: e.target.value })}
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

          {/* Assign To */}
          <div>
            <label className="block text-sm font-medium mb-1">Assign To</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
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

          {/* Title */}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium mb-1">Add New Attachments</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            />
            {files.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {files.length} new file(s) selected
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
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
              disabled={loading || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : uploading ? 'Uploading...' : 'Update Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}