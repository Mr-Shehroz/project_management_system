// src/app/dashboard/qa-assign-modal.tsx
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

  const handleAssign = async () => {
    if (!selectedQA) {
      alert('Please select a QA reviewer');
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
        onClose();
        // Refresh tasks
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign QA');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Assign QA Reviewer</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Select QA Reviewer
            </label>
            <select
              value={selectedQA}
              onChange={(e) => setSelectedQA(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select QA Reviewer</option>
              {availableQAs.map((qa) => (
                <option key={qa.id} value={qa.id}>
                  {qa.name} ({qa.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={isAssigning || !selectedQA}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isAssigning ? 'Assigning...' : 'Assign QA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}