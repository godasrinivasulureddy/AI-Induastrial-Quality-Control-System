import { Bell, Check, Trash2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { useAppStore } from "../store/useAppStore";
import { formatDateTime } from "../lib/utils";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markAsRead, clearNotifications } = useAppStore();

  return (
    <div className="mx-auto max-w-4xl p-2 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white flex items-center gap-2">
            <Bell className="h-7 w-7 text-cyan-400" /> Alerts & Notifications
          </h1>
          <p className="mt-2 text-zinc-400">View recent system events, model drifts, and deployment alerts.</p>
        </div>
        <div className="flex gap-2">
          {notifications.length > 0 && (
            <Button variant="secondary" onClick={clearNotifications}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear All
            </Button>
          )}
        </div>
      </div>

      <Panel className="p-0">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Bell className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
            <h2 className="text-lg font-medium text-white">No alerts</h2>
            <p>You're all caught up! No recent system events or model alerts.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`flex items-start gap-4 p-5 transition-colors hover:bg-white/5 ${notification.is_read ? "opacity-75" : "bg-cyan-900/10"}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm font-medium ${notification.is_read ? "text-zinc-300" : "text-white"}`}>
                    {notification.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">{notification.message}</p>
                  <p className="mt-2 text-xs text-zinc-500">{formatDateTime(notification.created_at)}</p>
                </div>
                {!notification.is_read && (
                  <Button variant="ghost" size="icon" onClick={() => markAsRead(notification.id)} title="Mark as read">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default NotificationsPage;
