import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Shield, UserCircle, Activity, Save, Edit3, X, Calendar, Flame, Star } from "lucide-react";

import { useAppStore } from "../store/useAppStore";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { Badge } from "../components/ui/badge";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, bootstrap } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        password: "",
      });
    }
  }, [user]);

  const [calendarData, setCalendarData] = useState<Array<{date: string; count: number}>>([]);

  useEffect(() => {
    api.get<Array<{date: string; count: number}>>("/users/me/activity-calendar")
      .then((res) => setCalendarData(res.data))
      .catch(() => setCalendarData([]));
  }, []);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const updatePayload: Record<string, string> = {
      username: formData.username,
      email: formData.email,
    };
    if (formData.password.trim() !== "") {
      updatePayload.password = formData.password;
    }

    try {
      await api.put(`/users/${user?.id}`, updatePayload);
      await bootstrap(); // Reload user state
      setSuccess("Profile updated successfully!");
      setEditMode(false);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const buildCalendarGrid = () => {
    const today = new Date();
    const activityMap = new Map(calendarData.map((d) => [d.date, d.count]));
    const weeks: Array<Array<{date: string; count: number}>> = [];
    // Start from 52 weeks ago (Sunday)
    const start = new Date(today);
    start.setDate(start.getDate() - (52 * 7 + start.getDay()));
    let currentWeek: Array<{date: string; count: number}> = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const dateStr = cursor.toISOString().slice(0, 10);
      currentWeek.push({ date: dateStr, count: activityMap.get(dateStr) || 0 });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length) weeks.push(currentWeek);
    return weeks;
  };

  const calendarWeeks = buildCalendarGrid();
  const totalActiveDays = calendarData.filter((d) => d.count > 0).length;

  // Calculate streak
  const calculateStreak = () => {
    const today = new Date();
    const dateSet = new Set(calendarData.filter((d) => d.count > 0).map((d) => d.date));
    let streak = 0;
    const cursor = new Date(today);
    while (true) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (dateSet.has(dateStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };
  const currentStreak = calculateStreak();

  const mostActiveDay = calendarData.reduce<{date: string; count: number} | null>(
    (best, d) => (!best || d.count > best.count ? d : best), null
  );

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-zinc-800";
    if (count <= 2) return "bg-emerald-900";
    if (count <= 5) return "bg-emerald-700";
    if (count <= 10) return "bg-emerald-500";
    return "bg-emerald-400";
  };

  if (!user) {
    return <div className="text-zinc-400">Loading profile state...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 border-cyan-300/30 bg-cyan-300/10 text-cyan-100">Identity & Credentials</Badge>
          <h1 className="text-4xl font-semibold text-white">Operator Profile</h1>
          <p className="mt-2 text-zinc-400">Manage account information, authentication creds, and system access levels.</p>
        </div>
        <div>
          <Button variant={editMode ? "secondary" : "primary"} onClick={() => setEditMode(!editMode)}>
            {editMode ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {editMode ? "Cancel" : "Edit Profile"}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-200">{error}</div>}
      {success && <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-6 flex flex-col items-center justify-center text-center">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username || "AI"}`}
            alt=""
            className="h-28 w-28 rounded-full border-2 border-cyan-300/40 bg-zinc-800 object-cover shadow-[0_0_24px_rgba(103,232,249,0.15)]"
          />
          <h2 className="mt-4 text-2xl font-bold text-white">{user.username || "operator"}</h2>
          <p className="mt-1 text-sm text-zinc-500 capitalize">{user.role || "Operator"}</p>
          <div className="mt-6 w-full space-y-2 border-t border-white/5 pt-4 text-left text-sm text-zinc-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={user.is_active ? "text-emerald-400" : "text-zinc-500"}>{user.is_active ? "Active" : "Inactive"}</span>
            </div>
            <div className="flex justify-between">
              <span>Admin privilege:</span>
              <span className={user.is_admin ? "text-cyan-400" : "text-zinc-500"}>{user.is_admin ? "Authorized" : "Standard"}</span>
            </div>
          </div>
        </Panel>

        <Panel className="p-6 lg:col-span-2">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-cyan-300" />
            Account Details
          </h3>
          {editMode ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Username</label>
                <input
                  type="text"
                  name="username"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                  value={formData.username}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  name="password"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                  value={formData.password}
                  onChange={handleFormChange}
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4" />
                  {loading ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="grid grid-cols-3 border-b border-white/5 pb-3">
                <span className="text-zinc-500 font-medium">Username</span>
                <span className="col-span-2 text-white">{user.username}</span>
              </div>
              <div className="grid grid-cols-3 border-b border-white/5 pb-3">
                <span className="text-zinc-500 font-medium">Email Address</span>
                <span className="col-span-2 text-white">{user.email}</span>
              </div>
              <div className="grid grid-cols-3 border-b border-white/5 pb-3">
                <span className="text-zinc-500 font-medium">Role Level</span>
                <span className="col-span-2 flex items-center gap-1.5 text-white capitalize">
                  {user.is_admin ? <Shield className="h-4 w-4 text-cyan-300" /> : <User className="h-4 w-4 text-zinc-400" />}
                  {user.is_admin ? "Administrator" : "Standard Operator"}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-400" />
          Activity Calendar
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{totalActiveDays}</p>
            <p className="text-xs text-zinc-400 mt-1">Active Days</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1"><Flame className="h-5 w-5" />{currentStreak}</p>
            <p className="text-xs text-zinc-400 mt-1">Current Streak</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400 flex items-center justify-center gap-1"><Star className="h-5 w-5" />{mostActiveDay?.count || 0}</p>
            <p className="text-xs text-zinc-400 mt-1">Best Day{mostActiveDay ? ` (${mostActiveDay.date})` : ""}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} activities`}
                    className={`h-[13px] w-[13px] rounded-sm ${getCellColor(day.count)} transition-colors hover:ring-1 hover:ring-white/30`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span>Less</span>
          <div className="h-[11px] w-[11px] rounded-sm bg-zinc-800" />
          <div className="h-[11px] w-[11px] rounded-sm bg-emerald-900" />
          <div className="h-[11px] w-[11px] rounded-sm bg-emerald-700" />
          <div className="h-[11px] w-[11px] rounded-sm bg-emerald-500" />
          <div className="h-[11px] w-[11px] rounded-sm bg-emerald-400" />
          <span>More</span>
        </div>
      </Panel>
    </div>
  );
}
export default ProfilePage;
