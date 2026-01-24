// src/app/dashboard/qa-review-modal.tsx
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

type FeedbackItem = {
  id: string;
  image?: {
    url: string;
    public_id: string;
    original_name: string;
    format: string;
    bytes: number;
  };
  note: string;
};

export default function QAReviewModal({
  taskId,
  taskTitle,
  taskDescription,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();

  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'APPROVED' | 'REWORK'>('APPROVED');
  const [loading, setLoading] = useState(false);

  // For QA assignment (when user is Admin/PM/Team Leader)
  const [availableQAs, setAvailableQAs] = useState<User[]>([]);
  const [selectedQA, setSelectedQA] = useState('');
  const [isAssigningQA, setIsAssigningQA] = useState(false);

  // For QA feedback with images
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Handle paste event
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!e.clipboardData || !e.clipboardData.items) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault(); // Prevent default paste behavior

    setUploadingImages(true);
    try {
      const newFeedbackItems: FeedbackItem[] = [];

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newFeedbackItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            image: {
              url: data.url,
              public_id: data.public_id,
              original_name: data.original_name,
              format: data.format,
              bytes: data.bytes
            },
            note: ''
          });
        }
      }

      setFeedbackItems(prev => [...prev, ...newFeedbackItems]);
    } catch (err) {
      alert('Failed to upload pasted images');
    } finally {
      setUploadingImages(false);
    }
  };

  // Fetch QA users if user has permission to assign QA
  useEffect(() => {
    const fetchQAs = async () => {
      if (session?.user?.role === 'ADMIN' ||
        session?.user?.role === 'PROJECT_MANAGER' ||
        session?.user?.role === 'TEAM_LEADER') {
        try {
          const res = await fetch('/api/users/qa');
          if (res.ok) {
            const data = await res.json();
            setAvailableQAs(data.qas || []);
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchQAs();
  }, [session]);

  // Handle file selection for feedback images
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setUploadingImages(true);
    try {
      const newFeedbackItems: FeedbackItem[] = [];

      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newFeedbackItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            image: {
              url: data.url,
              public_id: data.public_id,
              original_name: data.original_name,
              format: data.format,
              bytes: data.bytes
            },
            note: ''
          });
        }
      }

      setFeedbackItems(prev => [...prev, ...newFeedbackItems]);
    } catch (err) {
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  // Update feedback item note
  const updateFeedbackNote = (id: string, note: string) => {
    setFeedbackItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, note } : item
      )
    );
  };

  // Remove feedback item
  const removeFeedbackItem = (id: string) => {
    setFeedbackItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAssignQA = async () => {
    if (!selectedQA) {
      alert('Please select a QA reviewer');
      return;
    }

    setIsAssigningQA(true);
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
      setIsAssigningQA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare feedback items
      const feedback = feedbackItems.map(item => ({
        image: item.image ? {
          url: item.image.url,
          public_id: item.image.public_id,
          original_name: item.image.original_name,
          format: item.image.format,
          bytes: item.image.bytes
        } : undefined,
        note: item.note
      }));

      const res = await fetch('/api/notes/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, note, status, feedback }),
      });

      if (res.ok) {
        onClose();
        // Refresh tasks after review
        window.dispatchEvent(new CustomEvent('refresh-tasks'));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit review');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Check if user can assign QA or just review
  const canAssignQA = session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'PROJECT_MANAGER' ||
    session?.user?.role === 'TEAM_LEADER';

  const canReviewQA = session?.user?.role === 'QA';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">
          QA Feedback for "{taskTitle}"
        </h2>

        {canAssignQA && (
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
                onClick={handleAssignQA}
                disabled={isAssigningQA || !selectedQA}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isAssigningQA ? 'Assigning...' : 'Assign QA'}
              </button>
            </div>
          </div>
        )}

        {canReviewQA && (
          <form onSubmit={handleSubmit} className="space-y-4" onPaste={handlePaste}>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Status</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'APPROVED'}
                    onChange={() => setStatus('APPROVED')}
                    className="text-blue-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Approve</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'REWORK'}
                    onChange={() => setStatus('REWORK')}
                    className="text-red-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Rework</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Overall Notes</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Provide overall feedback..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
              />
            </div>

            {/* Feedback Items */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Add Reference Images & Comments
              </label>
              <input
                type="file"
                multiple
                onChange={handleImageUpload}
                accept="image/*"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={uploadingImages}
              />
              {uploadingImages && <p className="text-sm text-gray-600 mt-1">Uploading...</p>}

              {feedbackItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  {feedbackItems.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      {item.image && (
                        <div className="mb-2">
                          <img
                            src={item.image.url}
                            alt={`Feedback ${index + 1}`}
                            className="w-full h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                          />
                        </div>
                      )}
                      <textarea
                        value={item.note}
                        onChange={(e) => updateFeedbackNote(item.id, e.target.value)}
                        placeholder={`Add comment for image ${index + 1}...`}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={2}
                      />
                      <button
                        type="button"
                        onClick={() => removeFeedbackItem(item.id)}
                        className="mt-2 text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}