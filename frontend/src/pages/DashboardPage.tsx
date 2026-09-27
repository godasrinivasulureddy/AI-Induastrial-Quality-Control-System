import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { MetricCard } from "../components/MetricCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { classForPrediction, formatDateTime, percent } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import type { Activity as ActivityType, AnalyticsSummary, Prediction } from "../types";

const pieColors = ["#67e8f9", "#34d399", "#fbbf24", "#fb7185"];

export function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [modelStatus, setModelStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [analyticsResponse, predictionsResponse, activityResponse, modelResponse] = await Promise.all([
      api.get<AnalyticsSummary>("/analytics/summary"),
      api.get<Prediction[]>("/predictions/me"),
      api.get<ActivityType[]>("/users/me/activities"),
      api.get<Record<string, unknown>>("/predictions/status"),
    ]);
    setSummary(analyticsResponse.data);
    setPredictions(predictionsResponse.data);
    setActivities(activityResponse.data.slice(0, 8));
    setModelStatus(modelResponse.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const latest = predictions[0];
  const chartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Defective", count: summary.defective_count },
      { name: "Non-defective", count: summary.non_defective_count },
    ];
  }, [summary]);

  if (loading) {
    return <div className="text-zinc-400">Loading AI Quality Analytics Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 border-cyan-300/30 bg-cyan-300/10 text-cyan-100">AI Operations Center</Badge>
          <h1 className="text-4xl font-semibold text-white">Welcome back, {user?.username || "operator"}</h1>
          <p className="mt-2 text-zinc-400">AI Quality Analytics Dashboard with real-time inspection data and model status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/detect">
              <Gauge className="h-4 w-4" />
              Live detect
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total predictions" value={summary?.total_predictions ?? 0} detail="User-owned inspection records" icon={BarChart3} tone="cyan" />
        <MetricCard title="Defect rate" value={`${summary?.defect_rate ?? 0}%`} detail="Defective over total" icon={AlertTriangle} tone="rose" />
        <MetricCard title="Avg confidence" value={percent(summary?.average_confidence)} detail="Mean confidence score" icon={CheckCircle2} tone="emerald" />
        <MetricCard title="Prediction rate" value={`${summary?.prediction_rate_per_hour ?? 0}/hr`} detail="Throughput estimate" icon={Clock3} tone="amber" />
        <MetricCard
          title="Model status"
          value={modelStatus?.using_fallback ? "Fallback" : "YOLO"}
          detail={String(modelStatus?.model_version || "fallback-cv-v1")}
          icon={BrainCircuit}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Defect distribution</h2>
              <p className="text-sm text-zinc-500">Defective vs non-defective records</p>
            </div>
            <Button asChild variant="secondary" size="sm"><Link to="/upload"><UploadCloud className="h-4 w-4" />Upload</Link></Button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(6, 182, 212, 0.4)", borderRadius: 8 }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#a1a1aa" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, index) => <Cell key={index} fill={index === 0 ? "#fb7185" : "#34d399"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Confidence bands</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary?.confidence_bands || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={4}>
                  {(summary?.confidence_bands || []).map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(6, 182, 212, 0.4)", borderRadius: 8 }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#a1a1aa" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <h2 className="text-xl font-semibold text-white">Monthly trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary?.monthly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(6, 182, 212, 0.4)", borderRadius: 8 }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#a1a1aa" }} />
                <Line type="monotone" dataKey="defective" stroke="#fb7185" strokeWidth={2} />
                <Line type="monotone" dataKey="non_defective" stroke="#34d399" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Smart AI insights</h2>
          <div className="mt-4 space-y-3">
            {(summary?.insights || []).map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">{item}</div>
            ))}
            {(summary?.recommendations || []).map((item) => (
              <div key={item} className="rounded-md border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">{item}</div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Recent predictions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-3">Result</th>
                  <th>Confidence</th>
                  <th>Source</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 6).map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="py-3"><span className={`rounded-md border px-2 py-1 text-xs ${classForPrediction(item.prediction_label)}`}>{item.prediction_label}</span></td>
                    <td>{percent(item.confidence_score, 2)}</td>
                    <td className="text-zinc-400">{item.source || "ai"}</td>
                    <td className="text-zinc-400">{formatDateTime(item.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Activity feed</h2>
          <div className="mt-4 space-y-3">
            {activities.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-3">
                <Activity className="mt-0.5 h-4 w-4 text-cyan-200" />
                <div>
                  <p className="text-sm text-white">{item.description || item.activity_type}</p>
                  <p className="text-xs text-zinc-500">{formatDateTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
            {!activities.length ? <p className="text-sm text-zinc-500">No activity yet.</p> : null}
          </div>
        </Panel>
      </div>

      {latest ? (
        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Latest detection summary</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Latest result is <span className="text-white">{latest.prediction_label}</span> with {percent(latest.confidence_score, 2)} confidence.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

export default DashboardPage;
