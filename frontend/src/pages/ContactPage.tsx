import { useNavigate } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "../components/ui/panel";

export function ContactPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-950 px-4 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Button onClick={() => navigate(-1)} variant="secondary">Back</Button>
          <h1 className="mt-10 text-5xl font-semibold">Talk to quality AI</h1>
          <p className="mt-4 text-zinc-400">Connect the dashboard to your production line, lab workflow, or classroom demo.</p>
          <div className="mt-8 space-y-3 text-sm text-zinc-300">
            <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-cyan-200" /> support@optivision.local</p>
            <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-cyan-200" /> +1 000 000 0000</p>
            <p className="flex items-center gap-3"><MapPin className="h-4 w-4 text-cyan-200" /> Industrial AI Cloud</p>
          </div>
        </div>
        <Panel className="p-6">
          <form className="space-y-4">
            <Input placeholder="Name" />
            <Input placeholder="Email" />
            <textarea className="min-h-40 w-full rounded-md border border-white/10 bg-white/7 p-3 text-sm outline-none" placeholder="Message" />
            <Button type="button">Send message</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
