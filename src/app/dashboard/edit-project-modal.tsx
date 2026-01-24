// src/app/dashboard/edit-project-modal.tsx
'use client';

import { useState } from 'react';

type Project = {
  id: string;
  name: string;
  client_name?: string;
  website_url?: string;
  fiverr_order_id?: string;
};

type EditProjectModalProps = {
  project: Project;
  onClose: () => void;
  onUpdated: () => void;
};

export default function EditProjectModal({
  project,
  onClose,
  onUpdated,
}: EditProjectModalProps) {
  const [formData, setFormData] = useState({
    name: project.name,
    client_name: project.client_name || '',
    website_url: project.website_url || '',
    fiverr_order_id: project.fiverr_order_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update project');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Project</h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Project Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Client Name</label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium mb-1">Website URL</label>
            <input
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Fiverr Order ID */}
          <div>
            <label className="block text-sm font-medium mb-1">Fiverr Order ID</label>
            <input
              type="text"
              value={formData.fiverr_order_id}
              onChange={(e) => setFormData({ ...formData, fiverr_order_id: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}