import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sliders, Monitor, Shield, Bell, Save, Sparkles } from "lucide-react";

import { useAppStore } from "../store/useAppStore";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { Badge } from "../components/ui/badge";

export function SettingsPage() {
  const { settings, bootstrap } = useAppStore();
  const [activeTab, setActiveTab] = useState<"system" | "model" | "notifications" | "security">("system");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    theme: "dark",
    confidence_threshold: 0.55,
    auto_save_detections: true,
    notifications_enabled: true,
    voice_notifications: false,
    detection_sensitivity: 0.65,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        theme: settings.theme || "dark",
        confidence_threshold: settings.confidence_threshold ?? 0.55,
        auto_save_detections: settings.auto_save_detections ?? true,
        notifications_enabled: settings.notifications_enabled ?? true,
        voice_notifications: settings.voice_notifications ?? false,
        detection_sensitivity: settings.detection_sensitivity ?? 0.65,
      });
    }
  }, [settings]);

  const handleToggle = (name: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSliderChange = (name: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess("");
    setError("");
    try {
      await api.put("/settings/me", formData);
      await bootstrap(); // Sync globally
      setSuccess("Configuration saved successfully!");
      // Toggle client theme classes instantly
      document.documentElement.classList.toggle("light", formData.theme === "light");
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setError("Failed to persist configurations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 border-cyan-300/30 bg-cyan-300/10 text-cyan-100">OptiVision Operations Control</Badge>
          <h1 className="text-4xl font-semibold text-white">System Settings</h1>
          <p className="mt-2 text-zinc-400">Configure visual themes, machine learning inspection thresholds, and alerting sensitivities.</p>
        </div>
        <div>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4" />
            {loading ? "Saving Settings..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {success && <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">{success}</div>}
      {error && <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          {(["system", "model", "notifications", "security"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition text-left ${
                activeTab === tab ? "bg-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]" : "text-zinc-500 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab === "system" && <Monitor className="h-4 w-4" />}
              {tab === "model" && <Sliders className="h-4 w-4" />}
              {tab === "notifications" && <Bell className="h-4 w-4" />}
              {tab === "security" && <Shield className="h-4 w-4" />}
              <span className="capitalize">{tab} settings</span>
            </button>
          ))}
        </div>

        <Panel className="p-6 lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {activeTab === "system" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">UI & System Styling</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <p className="font-semibold text-white">Visual Mode</p>
                      <p className="text-xs text-zinc-500">Choose between our high-contrast Dark theme or classic Light theme.</p>
                    </div>
                    <select
                      value={formData.theme}
                      onChange={(e) => handleSelectChange("theme", e.target.value)}
                      className="h-10 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:outline-none"
                    >
                      <option value="dark">Dark Theme</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <p className="font-semibold text-white">Production Mode</p>
                      <p className="text-xs text-zinc-500">Toggles extended system diagnostics logging for cloud pipelines.</p>
                    </div>
                    <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200">Active</Badge>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "model" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Machine Learning Calibration</h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white">Confidence Threshold: {(formData.confidence_threshold * 100).toFixed(0)}%</p>
                        <p className="text-xs text-zinc-500">Minimum score required to log a predicted frame as non-defective/defective.</p>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.95"
                      step="0.05"
                      className="w-full accent-cyan-300"
                      value={formData.confidence_threshold}
                      onChange={(e) => handleSliderChange("confidence_threshold", Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white">Heuristic Canny Sensitivity: {(formData.detection_sensitivity * 100).toFixed(0)}%</p>
                        <p className="text-xs text-zinc-500">Fine-tunes Canny edge detector for OpenCV contour overlays.</p>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="0.9"
                      step="0.05"
                      className="w-full accent-cyan-300"
                      value={formData.detection_sensitivity}
                      onChange={(e) => handleSliderChange("detection_sensitivity", Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div>
                      <p className="font-semibold text-white">Auto-save camera detections</p>
                      <p className="text-xs text-zinc-500">Save camera frames automatically to the SQL database during streaming.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-cyan-300"
                      checked={formData.auto_save_detections}
                      onChange={() => handleToggle("auto_save_detections")}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Operations Alerts</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <p className="font-semibold text-white">SaaS System Notifications</p>
                      <p className="text-xs text-zinc-500">Send notifications for system health, database limits, and retraining drift.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-cyan-300"
                      checked={formData.notifications_enabled}
                      onChange={() => handleToggle("notifications_enabled")}
                    />
                  </div>

                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <p className="font-semibold text-white">Audio/Voice Alerts</p>
                      <p className="text-xs text-zinc-500">Enable voice alerts on defect trigger threshold spikes.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-cyan-300"
                      checked={formData.voice_notifications}
                      onChange={() => handleToggle("voice_notifications")}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Security Credentials</h2>
                <p className="text-sm text-zinc-400 leading-6">
                  OptiVision runs under secure JWT verification tokens. Admin authorizations allow user privilege management, audit review, and retraining script triggers. Keep secret keys private in `.env` files.
                </p>
              </div>
            )}
          </motion.div>
        </Panel>
      </div>
    </div>
  );
}
export default SettingsPage;
