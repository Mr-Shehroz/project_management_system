// src/app/dashboard/notifications-bell.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

type Notification = {
  id: string;
  type: string;
  created_at: string;
  is_read: boolean;
  task_id: string;
};

export default function NotificationsBell() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [session]);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const formatType = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return 'Task assigned';
      case 'TASK_COMPLETED':
        return 'Task completed';
      case 'QA_REVIEWED':
        return 'QA reviewed';
      case 'READY_FOR_ASSIGNMENT':
        return 'Ready for assignment';
      default:
        return type;
    }
  };

  if (loading) return <div className="w-6 h-6"></div>;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition relative"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-700 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto"
          style={{ 
            msOverflowStyle: 'none', 
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-300 dark:border-gray-600">
            <h3 className="font-semibold text-gray-800 dark:text-white">Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
          ) : (
            <ul className="divide-y divide-gray-300 dark:divide-gray-600">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                    !notif.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {formatType(notif.type)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(notif.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="mt-2 px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-sm"
                    >
                      Mark as read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}