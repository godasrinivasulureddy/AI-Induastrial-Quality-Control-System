import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { classForPrediction, formatDateTime, percent } from "../lib/utils";
import type { Prediction } from "../types";

export function HistoryPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await api.get<Prediction[]>("/predictions/me");
    setPredictions(response.data);
    setSelected([]);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const allSelected = useMemo(() => predictions.length > 0 && selected.length === predictions.length, [predictions, selected]);

  const toggleAll = () => {
    setSelected(allSelected ? [] : predictions.map((item) => item.id));
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Are you sure you want to delete ${selected.length} selected prediction(s)? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      await api.post("/predictions/delete-multiple", selected);
      await load();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.response?.data?.detail || "Failed to delete selected records.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Audit trail</Badge>
          <h1 className="mt-3 text-4xl font-semibold text-white">Prediction history</h1>
          <p className="mt-2 text-zinc-400">Select records with checkboxes, delete selected records, and review real timestamps.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
          <Button variant="danger" onClick={deleteSelected} disabled={!selected.length || loading}>
            <Trash2 className="h-4 w-4" />
            Delete ({selected.length})
          </Button>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-zinc-400">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3">S.No</th>
                <th className="px-4 py-3">Prediction</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Image</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((item, index) => (
                <tr key={item.id} className="border-b border-white/10">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{index + 1}</td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs ${classForPrediction(item.prediction_label)}`}>{item.prediction_label}</span></td>
                  <td className="px-4 py-3">{percent(item.confidence_score, 2)}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.source || "ai"}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDateTime(item.timestamp)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-zinc-500">{item.image_path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!predictions.length ? <div className="p-8 text-center text-sm text-zinc-500">No prediction records yet.</div> : null}
      </Panel>
    </div>
  );
}
