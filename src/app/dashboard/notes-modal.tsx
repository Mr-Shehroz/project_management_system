// src/app/dashboard/notes-modal.tsx
'use client';

import { useState } from 'react';

export default function NotesModal({
  taskId,
  type,
  onClose,
}: {
  taskId: string;
  type: 'dev' | 'qa';
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = type === 'dev' ? '/api/notes/dev' : '/api/notes/qa';
      const body = type === 'dev' 
        ? { task_id: taskId, note }
        : { task_id: taskId, note, status: 'APPROVED' }; // or 'REWORK'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save note');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">
          {type === 'dev' ? 'Add Developer Note' : 'QA Review'}
        </h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            placeholder="Enter your note..."
            className="w-full border rounded px-3 py-2"
            rows={4}
          />
          {type === 'qa' && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="w-full border rounded px-3 py-2">
                <option>APPROVED</option>
                <option>REWORK</option>
              </select>
            </div>
          )}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}