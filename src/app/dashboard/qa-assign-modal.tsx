// src/app/dashboard/qa-assign-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

export default function QAAssignModal({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const { data: session } = useSession();

  const [availableQAs, setAvailableQAs] = useState<User[]>([]);
  const [selectedQA, setSelectedQA] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch QA users
  useEffect(() => {
    const fetchQAs = async () => {
      try {
        const res = await fetch('/api/users/qa');
        if (res.ok) {
          const data = await res.json();
          setAvailableQAs(data.qas || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchQAs();
  }, []);

  // In your QA Assign Modal:
  const handleAssign = async () => {
    if (!selectedQA) {
      toast.error('Please select a QA reviewer');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign-qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qa_id: selectedQA }),
      });

      if (res.ok) {
        toast.success('QA reviewer assigned successfully!');
        onClose();
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to assign QA');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      {/* Soft backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Assign QA Reviewer</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Body */}
          <div className="p-6">

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Select QA Reviewer
                </label>
                <select
                  value={selectedQA}
                  onChange={(e) => setSelectedQA(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select QA Reviewer</option>
                  {availableQAs.map((qa) => (
                    <option key={qa.id} value={qa.id}>
                      {qa.name} ({qa.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={isAssigning || !selectedQA}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-lg transition-all"
                >
                  {isAssigning ? 'Assigning...' : 'Assign QA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}