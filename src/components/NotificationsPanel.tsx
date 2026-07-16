import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFarm } from '@/contexts/FarmContext';
import type { Notification } from '@/db/types';

export default function NotificationsPanel() {
  const { authUser, getNotifications, markNotificationRead } = useAuth();
  const { currentFarmId } = useFarm();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentFarmId || !authUser) return;
    (async () => {
      const notifs = await getNotifications(currentFarmId);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    })();
  }, [currentFarmId, authUser, getNotifications, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkRead(id: number) {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  function getIcon(type: string) {
    switch (type) {
      case 'membership_request': return 'person_add';
      case 'membership_approved': return 'check_circle';
      case 'membership_rejected': return 'cancel';
      default: return 'info';
    }
  }

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="notifications-panel" ref={ref}>
      <button className="notifications-trigger" onClick={() => setOpen(!open)}>
        <span className="material-icons-outlined">notifications</span>
        {unreadCount > 0 && <span className="notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="notifications-count">{unreadCount} new</span>
            )}
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">
                <span className="material-icons-outlined" style={{ fontSize: 36, opacity: 0.3 }}>notifications_none</span>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notification-item ${n.read ? '' : 'unread'}`}
                  onClick={() => n.id && handleMarkRead(n.id)}
                >
                  <span className="material-icons-outlined notification-icon">{getIcon(n.type)}</span>
                  <div className="notification-content">
                    <div className="notification-title">{n.title}</div>
                    <div className="notification-message">{n.message}</div>
                    <div className="notification-time">{getTimeAgo(n.createdAt)}</div>
                  </div>
                  {!n.read && <div className="notification-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
