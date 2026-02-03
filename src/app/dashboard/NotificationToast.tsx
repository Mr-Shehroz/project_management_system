// src/app/dashboard/NotificationToast.tsx
'use client';

import { useEffect, useRef } from 'react';
import { 
  Bell, X, CheckCircle, AlertTriangle, HelpCircle, 
  Clock, User, RefreshCw, Upload 
} from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  message: string;
  taskId?: string;
  type?: string; // Add type for better icon selection
};

// Helper function to get icon based on notification type or title
function getNotificationIcon(type: string | undefined, title: string) {
  const lowerTitle = title.toLowerCase();

  if (
    type === 'TIME_EXCEEDED' ||
    lowerTitle.includes('time limit exceeded') ||
    lowerTitle.includes('⏰')
  ) {
    return <Clock className="w-6 h-6 text-red-600 dark:text-red-400" />;
  }

  if (
    type === 'HELP_REQUEST' ||
    lowerTitle.includes('help requested') ||
    lowerTitle.includes('🆘')
  ) {
    return <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
  }

  if (
    type === 'QA_REVIEWED' ||
    lowerTitle.includes('qa review') ||
    lowerTitle.includes('🔍')
  ) {
    return <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
  }

  if (
    type === 'TASK_APPROVED' ||
    lowerTitle.includes('approved') ||
    lowerTitle.includes('✅')
  ) {
    return <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />;
  }

  if (
    type === 'TASK_REWORK' ||
    lowerTitle.includes('rework') ||
    lowerTitle.includes('🔄')
  ) {
    return <RefreshCw className="w-6 h-6 text-orange-600 dark:text-orange-400" />;
  }
  
  if (
    type === 'TASK_RESUBMITTED' ||
    lowerTitle.includes('resubmitted') ||
    lowerTitle.includes('📤')
  ) {
    return <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
  }

  if (
    lowerTitle.includes('error') ||
    lowerTitle.includes('failed') ||
    lowerTitle.includes('⚠️')
  ) {
    return <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />;
  }

  // Default bell icon
  return <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
}

// Helper function to get border color based on notification type
function getBorderColor(type: string | undefined, title: string) {
  const lowerTitle = title.toLowerCase();
  
  if (type === 'TIME_EXCEEDED' || lowerTitle.includes('time limit exceeded') || lowerTitle.includes('⏰')) {
    return 'border-red-500';
  }
  
  if (type === 'HELP_REQUEST' || lowerTitle.includes('help requested') || lowerTitle.includes('🆘')) {
    return 'border-purple-500';
  }
  
  if (type === 'QA_REVIEWED' || lowerTitle.includes('qa review') || lowerTitle.includes('🔍')) {
    return 'border-purple-500';
  }
  
  if (type === 'TASK_APPROVED' || lowerTitle.includes('approved') || lowerTitle.includes('✅')) {
    return 'border-green-500';
  }
  
  if (type === 'TASK_REWORK' || lowerTitle.includes('rework') || lowerTitle.includes('🔄')) {
    return 'border-orange-500';
  }
  
  if (type === 'TASK_RESUBMITTED' || lowerTitle.includes('resubmitted') || lowerTitle.includes('📤')) {
    return 'border-blue-500';
  }
  
  if (lowerTitle.includes('error') || lowerTitle.includes('failed') || lowerTitle.includes('⚠️')) {
    return 'border-yellow-500';
  }
  
  return 'border-blue-500';
}

// Helper function to get gradient background
function getGradientBackground(type: string | undefined, title: string) {
  const lowerTitle = title.toLowerCase();
  
  if (type === 'TIME_EXCEEDED' || lowerTitle.includes('time limit exceeded') || lowerTitle.includes('⏰')) {
    return 'from-red-600 to-red-700';
  }
  
  if (type === 'HELP_REQUEST' || lowerTitle.includes('help requested') || lowerTitle.includes('🆘')) {
    return 'from-purple-600 to-purple-700';
  }
  
  if (type === 'QA_REVIEWED' || lowerTitle.includes('qa review') || lowerTitle.includes('🔍')) {
    return 'from-purple-600 to-indigo-700';
  }
  
  if (type === 'TASK_APPROVED' || lowerTitle.includes('approved') || lowerTitle.includes('✅')) {
    return 'from-green-600 to-emerald-700';
  }
  
  if (type === 'TASK_REWORK' || lowerTitle.includes('rework') || lowerTitle.includes('🔄')) {
    return 'from-orange-600 to-red-700';
  }
  
  if (type === 'TASK_RESUBMITTED' || lowerTitle.includes('resubmitted') || lowerTitle.includes('📤')) {
    return 'from-blue-600 to-indigo-700';
  }
  
  return 'from-blue-600 to-purple-600';
}

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

  const icon = getNotificationIcon(notification.type, notification.title);
  const borderColor = getBorderColor(notification.type, notification.title);
  const gradientBg = getGradientBackground(notification.type, notification.title);

  return (
    <>
      <audio ref={audioRef}>
        <source src="/notification.mp3" type="audio/mpeg" />
      </audio>
      
      <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ${borderColor} min-w-[320px] max-w-[400px] overflow-hidden transition-all duration-300 hover:shadow-xl`}>
          {/* Header */}
          <div className={`bg-gradient-to-r ${gradientBg} px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                {icon}
              </div>
              <span className="font-semibold text-sm">{notification.title}</span>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {notification.message}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Action Button */}
            {notification.taskId && (
              <button
                onClick={onClick}
                className="mt-3 w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-[1.02]"
              >
                View Task
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}