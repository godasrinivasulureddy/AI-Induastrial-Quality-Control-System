import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Camera,
  Check,
  Factory,
  Gauge,
  Layers3,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { Badge } from "../components/ui/badge";

const features = [
  { title: "Real-time camera AI", icon: Camera, detail: "Live frame detection, overlays, FPS, and confidence scoring." },
  { title: "Upload intelligence", icon: UploadCloud, detail: "Batch image and video inspection with persisted prediction history." },
  { title: "Quality analytics", icon: BarChart3, detail: "Defect trends, distribution, confidence bands, and recommendations." },
  { title: "Enterprise controls", icon: ShieldCheck, detail: "JWT auth, role-aware routes, admin monitoring, and settings." },
];

const stats = [
  ["24/7", "inspection readiness"],
  ["<2s", "fallback inference loop"],
  ["100%", "backend-driven data"],
  ["SQL", "PostgreSQL-ready ORM"],
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-surface-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-surface-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-300 text-zinc-950">
              <Factory className="h-5 w-5" />
            </div>
            <span className="font-semibold">OptiVision AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#analytics" className="hover:text-white">Analytics</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link to="/about" className="hover:text-white">About</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">
                Start
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1400px] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_0.6fr]">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <Badge className="mb-5 border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Industrial computer vision SaaS
            </Badge>
            <h1 className="max-w-[1000px] text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-[4.25rem]">
              <span className="whitespace-nowrap">AI Quality Control System</span> <br />
              for modern production lines
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Detect defects from live camera feeds, uploaded images, and inspection videos with a YOLO-ready backend,
              analytics, audit history, and enterprise-ready controls.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/signup">
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/login">Open dashboard</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(([value, label]) => (
                <Panel key={label} className="p-4">
                  <p className="text-2xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{label}</p>
                </Panel>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="relative"
          >
            <Panel className="overflow-hidden p-0">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Live Inspection</p>
                    <p className="text-xs text-zinc-500">Camera A3 / Line 4</p>
                  </div>
                  <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200">Online</Badge>
                </div>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-[1.4fr_0.6fr]">
                <div className="relative aspect-video overflow-hidden rounded-md border border-white/10 bg-zinc-950">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
                  <div className="absolute left-[20%] top-[25%] h-[45%] w-[55%] rounded-md border-2 border-cyan-300 shadow-[0_0_24px_rgba(103,232,249,.55)]">
                    <span className="absolute -top-5 left-0 rounded-sm bg-cyan-300 px-1.5 py-0.5 text-[9px] font-bold text-zinc-950 whitespace-nowrap">
                      surface anomaly 93.4%
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
                    <Badge className="px-1.5 py-0 text-[9px] leading-tight">FPS 28</Badge>
                    <Badge className="px-1.5 py-0 text-[9px] leading-tight">YOLO-ready</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {["Defective risk", "Confidence", "Throughput"].map((label, index) => (
                    <div key={label} className="rounded-md border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{label}</span>
                        <span className="font-semibold text-white">{[31, 93, 84][index]}%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${[31, 93, 84][index]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </motion.div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <Badge className="mb-4">Platform</Badge>
            <h2 className="text-3xl font-semibold">Built for inspection workflows</h2>
            <p className="mt-3 text-zinc-400">From webcam inference to admin monitoring, each module is connected to the FastAPI backend.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Panel key={feature.title} className="p-5 transition hover:border-cyan-300/30">
                <feature.icon className="h-6 w-6 text-cyan-200" />
                <h3 className="mt-5 font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{feature.detail}</p>
              </Panel>
            ))}
          </div>
        </section>

        <section id="analytics" className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {[
            { icon: Radar, title: "Smart insights", text: "AI recommendations surface defect-rate drift and confidence changes." },
            { icon: Layers3, title: "Clean architecture", text: "FastAPI routes, SQLAlchemy models, service layer, and typed React screens." },
            { icon: Lock, title: "Secure workflows", text: "JWT protected APIs, role-aware admin routes, and private prediction history." },
          ].map((item) => (
            <Panel key={item.title} className="p-6">
              <item.icon className="h-7 w-7 text-emerald-200" />
              <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{item.text}</p>
            </Panel>
          ))}
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {["Starter", "Production", "Enterprise"].map((plan, index) => (
              <Panel key={plan} className="p-6">
                <h3 className="text-xl font-semibold">{plan}</h3>
                <p className="mt-3 text-3xl font-semibold">{index === 0 ? "Free" : index === 1 ? "$49" : "Custom"}</p>
                <div className="mt-6 space-y-3 text-sm text-zinc-300">
                  {["Live detection", "Upload predictions", "Analytics dashboard", "Reports and history"].map((item) => (
                    <p key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-300" />
                      {item}
                    </p>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
        OptiVision AI Quality Cloud. Built for industrial defect detection.
      </footer>
    </div>
  );
}

export default LandingPage;
