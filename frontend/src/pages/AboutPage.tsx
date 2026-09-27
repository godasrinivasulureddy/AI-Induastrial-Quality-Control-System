import { Link } from "react-router-dom";
import { BrainCircuit, Database, Factory, ShieldCheck } from "lucide-react";

import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="secondary"><Link to="/">Back</Link></Button>
        <h1 className="mt-10 text-5xl font-semibold">Industrial AI quality control platform</h1>
        <p className="mt-5 max-w-3xl text-zinc-400">
          OptiVision combines FastAPI, SQLAlchemy, OpenCV, YOLO-ready inference, React, Recharts, and real-time camera
          workflows into one quality inspection product.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[Factory, BrainCircuit, Database, ShieldCheck].map((Icon, index) => (
            <Panel key={index} className="p-5">
              <Icon className="h-7 w-7 text-cyan-200" />
              <p className="mt-4 text-sm text-zinc-400">{["Production lines", "AI inference", "Audit history", "Protected APIs"][index]}</p>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
