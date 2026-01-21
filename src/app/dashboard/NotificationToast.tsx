// src/app/dashboard/NotificationToast.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  message: string;
  taskId?: string;
};

export default function NotificationToast({
  notification,
  onClose,
  onClick,
}: {
  notification: Notification;
  onClose: () => void;
  onClick: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    // Auto close after 8 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <>
      <audio ref={audioRef}>
        <source src="/notification.mp3" type="audio/mpeg" />
      </audio>
      
      <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-l-4 border-green-500 min-w-[350px] max-w-[400px] overflow-hidden">
          {/* Header */}
          <div className="bg-green-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bell className="w-5 h-5" />
              <span className="font-semibold">{notification.title}</span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-green-600 rounded p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {notification.message}
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                  Just now
                </p>
              </div>
            </div>

            {/* Action Button */}
            {notification.taskId && (
              <button
                onClick={onClick}
                className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                View Task
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}