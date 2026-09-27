import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  Camera,
  ClipboardList,
  Contact,
  FileText,
  Gauge,
  History,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  UploadCloud,
  UserCircle,
  X,
} from "lucide-react";

import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/detect", label: "Real-time", icon: Camera },
  { to: "/upload", label: "Upload", icon: UploadCloud },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/history", label: "History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserCircle },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/admin", label: "Admin", icon: Shield },
];

export function AppShell() {
  const navigate = useNavigate();
  const { user, notifications, sidebarOpen, setSidebarOpen, logout } = useAppStore();
  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="min-h-screen bg-surface-950 text-zinc-100">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-surface-900/95 p-4 backdrop-blur-xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <NavLink to="/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
              <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-300 text-zinc-950">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">OptiVision</p>
                <p className="text-xs text-zinc-500">AI Quality Cloud</p>
              </div>
            </NavLink>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="mt-8 flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.to === "/admin" && !user?.is_admin) return null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-zinc-400 transition hover:bg-white/8 hover:text-white",
                      isActive && "bg-white/10 text-white",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.to === "/notifications" && unread > 0 ? (
                    <span className="ml-auto rounded-md bg-rose-400 px-2 py-0.5 text-xs font-bold text-zinc-950">{unread}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-4 flex items-center gap-3">
              <img
                src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || "AI"}`}
                alt=""
                className="h-10 w-10 rounded-md border border-white/10 bg-white/10 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.username || "User"}</p>
                <p className="truncate text-xs capitalize text-zinc-500">{user?.role || "operator"}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-surface-950/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden max-w-lg flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-full rounded-md border border-white/10 bg-white/6 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
                placeholder="Search predictions, reports, settings"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge className="hidden border-emerald-300/30 bg-emerald-400/10 text-emerald-200 md:inline-flex">
                API Ready
              </Badge>
              <Button variant="secondary" size="icon" onClick={() => navigate("/notifications")}>
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={() => navigate("/contact")}>
                <Contact className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
