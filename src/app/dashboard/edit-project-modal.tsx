'use client';

import { useState } from 'react';
import { Loader2, X, Pencil } from 'lucide-react';

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
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Soft backdrop (no black bg) */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Edit Project
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
              {[
                {
                  label: 'Project Name *',
                  key: 'name',
                  type: 'text',
                  required: true,
                },
                {
                  label: 'Client Name',
                  key: 'client_name',
                  type: 'text',
                },
                {
                  label: 'Website URL',
                  key: 'website_url',
                  type: 'url',
                },
                {
                  label: 'Fiverr Order ID',
                  key: 'fiverr_order_id',
                  type: 'text',
                },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={(formData as any)[field.key]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [field.key]: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              ))}

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
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-lg flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
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
