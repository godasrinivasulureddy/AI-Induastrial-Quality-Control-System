import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-950 px-4 text-white">
      <Panel className="max-w-md p-8 text-center">
        <p className="text-sm text-cyan-200">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-zinc-400">This route is not registered in the AI quality workspace.</p>
        <Button asChild className="mt-6"><Link to="/dashboard">Go to dashboard</Link></Button>
      </Panel>
    </div>
  );
}
