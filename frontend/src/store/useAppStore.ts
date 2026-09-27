import { create } from "zustand";
import { api } from "../lib/api";
import type { NotificationItem, User, UserSetting } from "../types";

interface AppState {
  token: string | null;
  user: User | null;
  settings: UserSetting | null;
  notifications: NotificationItem[];
  sidebarOpen: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setSidebarOpen: (value: boolean) => void;
  bootstrap: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string | number) => Promise<void>;
  clearNotifications: () => Promise<void>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  token: localStorage.getItem("accessToken"),
  user: null,
  settings: null,
  notifications: [],
  sidebarOpen: false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  bootstrap: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      set({ token: null, user: null, settings: null, notifications: [] });
      return;
    }
    try {
      const [userResponse, settingsResponse, notificationsResponse] = await Promise.all([
        api.get<User>("/auth/me"),
        api.get<UserSetting>("/settings/me"),
        api.get<NotificationItem[]>("/notifications/"),
      ]);
      const theme = settingsResponse.data.theme || "dark";
      document.documentElement.classList.toggle("light", theme === "light");
      set({
        token,
        user: userResponse.data,
        settings: settingsResponse.data,
        notifications: notificationsResponse.data,
      });
    } catch (err) {
      console.error("Bootstrap API error, forcing logout:", err);
      get().logout();
    }
  },

  fetchNotifications: async () => {
    if (!get().token) return;
    const response = await api.get<NotificationItem[]>("/notifications/");
    set({ notifications: response.data });
  },
  markAsRead: async (id) => {
    if (!get().token) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      }));
    } catch (e) {
      console.error(e);
    }
  },
  clearNotifications: async () => {
    if (!get().token) return;
    try {
      await api.delete("/notifications/");
      set({ notifications: [] });
    } catch (e) {
      console.error(e);
      set({ notifications: [] }); // Clear locally if endpoint is missing
    }
  },
  logout: () => {
    // 1. Idempotently clear local token storage with a try-catch safety wrapper
    try {
      localStorage.removeItem("accessToken");
    } catch (err) {
      console.warn("[Zustand Logout] Failed to access localStorage:", err);
    }

    // 2. Safely purge theme customization classes on document element, resetting to default dark mode
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.classList.remove("light");
      }
    } catch (err) {
      console.warn("[Zustand Logout] Failed to reset document theme classes:", err);
    }

    // 3. Clear all session metadata and reset state attributes to clean defaults
    set({
      token: null,
      user: null,
      settings: null,
      notifications: [],
      sidebarOpen: false,
    });
  },
}));
