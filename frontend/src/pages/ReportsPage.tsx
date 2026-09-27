import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { classForPrediction, formatDateTime, percent } from "../lib/utils";
import type { Prediction } from "../types";

export function ReportsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<Prediction[]>("/predictions/me");
      setPredictions(response.data);
      setSelected([]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const allSelected = useMemo(
    () => predictions.length > 0 && selected.length === predictions.length,
    [predictions, selected],
  );

  const toggleAll = () => setSelected(allSelected ? [] : predictions.map((p) => p.id));

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected record(s)? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await api.post("/predictions/delete-multiple", selected);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete.");
      setLoading(false);
    }
  };

  const selectedRecords = useMemo(
    () => predictions.filter((p) => selected.includes(p.id)),
    [predictions, selected],
  );

  const exportReport = async () => {
    if (!selectedRecords.length) return;

    const defective = selectedRecords.filter((r) => r.prediction_label === "defective").length;
    const nonDefective = selectedRecords.length - defective;
    const avgConf = selectedRecords.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / selectedRecords.length;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OptiVision AI Quality Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #e4e4e7; padding: 40px; }
  .header { text-align: center; margin-bottom: 40px; padding: 32px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c4a6e 100%); border-radius: 16px; border: 1px solid rgba(6,182,212,0.3); }
  .header h1 { font-size: 28px; background: linear-gradient(90deg, #67e8f9, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .header p { color: #a1a1aa; margin-top: 8px; font-size: 14px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .card { background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center; }
  .card .value { font-size: 32px; font-weight: 700; }
  .card .label { color: #a1a1aa; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .rose { color: #fb7185; }
  .emerald { color: #34d399; }
  .cyan { color: #67e8f9; }
  .amber { color: #fbbf24; }
  table { width: 100%; border-collapse: collapse; background: #18181b; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
  th { background: rgba(255,255,255,0.05); color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 12px 16px; text-align: left; }
  td { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
  tr:hover { background: rgba(255,255,255,0.02); }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
  .defective { background: rgba(244,63,94,0.15); color: #fb7185; border: 1px solid rgba(244,63,94,0.3); }
  .non-defective { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
  .footer { text-align: center; margin-top: 32px; color: #52525b; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>OptiVision AI Quality Report</h1>
  <p>Generated on ${new Date().toLocaleString()} &bull; ${selectedRecords.length} record(s) selected</p>
</div>
<div class="summary">
  <div class="card"><div class="value cyan">${selectedRecords.length}</div><div class="label">Total Selected</div></div>
  <div class="card"><div class="value rose">${defective}</div><div class="label">Defective</div></div>
  <div class="card"><div class="value emerald">${nonDefective}</div><div class="label">Non-Defective</div></div>
  <div class="card"><div class="value amber">${(avgConf * 100).toFixed(1)}%</div><div class="label">Avg Confidence</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Prediction</th><th>Confidence</th><th>Source</th><th>Model</th><th>Timestamp</th></tr></thead>
  <tbody>
${selectedRecords.map((r, i) => `    <tr><td>${i + 1}</td><td><span class="badge ${r.prediction_label === "defective" ? "defective" : "non-defective"}">${r.prediction_label}</span></td><td>${((r.confidence_score || 0) * 100).toFixed(1)}%</td><td>${r.source || "ai"}</td><td>${r.model_version || "-"}</td><td>${new Date(r.timestamp).toLocaleString()}</td></tr>`).join("\n")}
  </tbody>
</table>
<div class="footer">
  <p>OptiVision AI Quality Control System &bull; Confidential Report</p>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `optivision_report_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);

    // Log activity
    try {
      await api.post("/reports/log-activity");
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Reports</Badge>
          <h1 className="mt-3 text-4xl font-semibold text-white">Quality Reports</h1>
          <p className="mt-2 text-zinc-400">Select records, export formatted HTML reports, or delete entries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="danger" onClick={deleteSelected} disabled={!selected.length || loading}>
            <Trash2 className="h-4 w-4" />
            Delete ({selected.length})
          </Button>
          <Button onClick={exportReport} disabled={!selected.length}>
            <Download className="h-4 w-4" />
            Export Report ({selected.length})
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
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((item, index) => (
                <tr key={item.id} className="border-b border-white/10 transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() =>
                        setSelected((cur) =>
                          cur.includes(item.id) ? cur.filter((id) => id !== item.id) : [...cur, item.id],
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md border px-2 py-1 text-xs ${classForPrediction(item.prediction_label)}`}>
                      {item.prediction_label}
                    </span>
                  </td>
                  <td className="px-4 py-3">{percent(item.confidence_score, 2)}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.source || "ai"}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.model_version || "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDateTime(item.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!predictions.length && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-500">No prediction records available for reporting.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default ReportsPage;
