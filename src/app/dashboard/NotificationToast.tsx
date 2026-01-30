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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-l-4 border-gradient-blue-purple min-w-[350px] max-w-[400px] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bell className="w-5 h-5" />
              <span className="font-semibold">{notification.title}</span>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                className="mt-3 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg"
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

        .border-gradient-blue-purple {
          border-image: linear-gradient(to bottom, #2563eb, #9333ea) 1;
        }
      `}</style>
    </>
  );
}