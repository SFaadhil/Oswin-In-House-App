import { useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const ICONS = {
  leave_request: Calendar,
  leave_request_admin: Calendar,
  leave_approved: Check,
  leave_rejected: Check,
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const res = await api.get("/notifications?limit=15");
      setItems(res.data.items || []);
      setUnread(res.data.unread_count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 30000); // poll every 30s
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetchData();
  };
  const markAll = async () => {
    await api.put("/notifications/read-all");
    fetchData();
  };
  const handleClick = async (n) => {
    if (!n.read) await markRead(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="relative p-2 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" data-testid="notification-bell" title="Notifications">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="notification-unread-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[480px] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl z-50" data-testid="notification-dropdown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1" data-testid="mark-all-read">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Bell size={20} className="mx-auto mb-2 opacity-40" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map(n => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button key={n._id} onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 ${!n.read ? "bg-primary/5" : ""}`}
                    data-testid={`notification-item-${n._id}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === "leave_approved" ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400" : n.type === "leave_rejected" ? "bg-red-100 dark:bg-red-900/20 text-destructive" : "bg-primary/10 text-primary"}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
