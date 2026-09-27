import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Panel } from "./ui/panel";

interface MetricCardProps {
  title: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
}

const tones = {
  cyan: "text-cyan-200 bg-cyan-400/10 border-cyan-300/20",
  emerald: "text-emerald-200 bg-emerald-400/10 border-emerald-300/20",
  amber: "text-amber-200 bg-amber-400/10 border-amber-300/20",
  rose: "text-rose-200 bg-rose-400/10 border-rose-300/20",
  violet: "text-violet-200 bg-violet-400/10 border-violet-300/20",
};

export function MetricCard({ title, value, detail, icon: Icon, tone = "cyan" }: MetricCardProps) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className={cn("grid h-10 w-10 place-items-center rounded-md border", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {detail ? <p className="mt-3 text-sm text-zinc-500">{detail}</p> : null}
    </Panel>
  );
}
