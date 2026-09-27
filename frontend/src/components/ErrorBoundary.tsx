import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "./ui/button";
import { Panel } from "./ui/panel";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Panel className="max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-300" />
          <h1 className="text-xl font-semibold text-white">Something failed to render</h1>
          <p className="mt-2 text-sm text-zinc-400">The application recovered the page shell. Reload to continue.</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Panel>
      </div>
    );
  }
}
