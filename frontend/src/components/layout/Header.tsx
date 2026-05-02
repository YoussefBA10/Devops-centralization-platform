import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEnvironment } from '../../context/EnvironmentContext';
import { 
  Bell, 
  Search, 
  LogOut, 
  User as UserIcon,
  ChevronDown
} from 'lucide-react';

import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/api';

import ClusterSelector from './ClusterSelector';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = React.useState<any[]>([]);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await markAllNotificationsAsRead();
      fetchNotifications();
    } catch (err) {
      console.error('Failed to clear all notifications', err);
    }
  };

  return (
    <header className="h-16 bg-card/50 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        {/* Selection Area */}
        <div className="flex items-center gap-2">
          <ClusterSelector />
        </div>

        {/* Search Bar */}
        <div className="max-w-md w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search resources, logs, tickets..." 
            className="w-full bg-secondary border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group/notifications">
          <button className="p-2 hover:bg-secondary rounded-lg relative text-muted-foreground hover:text-foreground transition-all duration-200">
            <Bell className="w-5 h-5" />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card animate-pulse"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover/notifications:opacity-100 group-hover/notifications:visible transition-all duration-200 transform origin-top right scale-95 group-hover/notifications:scale-100 overflow-hidden z-50">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Notifications
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] rounded-full">
                    {notifications.filter(n => !n.isRead).length} new
                  </span>
                )}
              </h3>
              <button 
                onClick={handleClearAll}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest font-bold"
              >
                Mark all as read
              </button>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-default relative group/item ${!n.isRead ? 'bg-primary/[0.02]' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? 'bg-primary' : 'bg-transparent'}`}></div>
                      <div className="space-y-1">
                        <p className={`text-xs font-bold ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-tighter mt-2">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!n.isRead && (
                      <button 
                        onClick={() => handleMarkRead(n.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover/item:opacity-100 p-1 hover:bg-primary/10 rounded transition-all"
                        title="Mark as read"
                      >
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-3 bg-secondary/10 border-t border-border text-center">
                <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest">
                  View All History
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-border mx-2"></div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 group cursor-pointer relative">
          <div className="text-right">
            <p className="text-sm font-semibold">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase() || 'User'}</p>
          </div>
          <div className="w-10 h-10 bg-secondary border border-border rounded-full flex items-center justify-center group-hover:border-primary/50 transition-all overflow-hidden">
            <UserIcon className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top right scale-95 group-hover:scale-100 p-2">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
