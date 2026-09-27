import { useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "../components/MetricCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { percent } from "../lib/utils";
import type { AnalyticsSummary } from "../types";

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await api.get<AnalyticsSummary>("/analytics/summary");
      setSummary(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load analytics data.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const distribution = summary?.distribution.length
    ? summary.distribution
    : [
        { name: "defective", value: 0 },
        { name: "non-defective", value: 0 },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Analytics</Badge>
          <h1 className="mt-3 text-4xl font-semibold text-white">AI Quality Analytics Dashboard</h1>
          <p className="mt-2 text-zinc-400">Interactive defect distribution, confidence analytics, and trend analysis.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}><Download className="h-4 w-4" />Export</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Defective" value={summary?.defective_count ?? 0} icon={BarChart3} tone="rose" />
        <MetricCard title="Non-defective" value={summary?.non_defective_count ?? 0} icon={BarChart3} tone="emerald" />
        <MetricCard title="Defect rate" value={`${summary?.defect_rate ?? 0}%`} icon={TrendingUp} tone="amber" />
        <MetricCard title="Average confidence" value={percent(summary?.average_confidence)} icon={TrendingUp} tone="cyan" />
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-200">{error}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-xl font-semibold">Defect distribution</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(6, 182, 212, 0.4)", borderRadius: 8 }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#a1a1aa" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {distribution.map((item) => <Cell key={item.name} fill={item.name.includes("defective") && !item.name.includes("non") ? "#fb7185" : "#34d399"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-xl font-semibold">Confidence distribution</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary?.confidence_bands || []} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={5}>
                  {(summary?.confidence_bands || []).map((item, index) => <Cell key={item.name} fill={["#67e8f9", "#34d399", "#fbbf24"][index % 3]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(6, 182, 212, 0.4)", borderRadius: 8 }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#a1a1aa" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="text-xl font-semibold">AI insights and recommendations</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[...(summary?.insights || []), ...(summary?.recommendations || [])].map((item) => (
            <div key={item} className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">{item}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
