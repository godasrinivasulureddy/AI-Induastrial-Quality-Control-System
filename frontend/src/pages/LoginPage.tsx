import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

export function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAppStore((state) => state.setToken);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    try {
      const response = await api.post<{ access_token: string }>("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      // Set token first
      setToken(response.data.access_token);
      // Then load user profile and other data
      try {
        await bootstrap();
      } catch (bootstrapErr) {
        console.warn("Bootstrap error, but token is set. Proceeding to dashboard.", bootstrapErr);
      }
      // Finally navigate to dashboard
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.response?.data?.detail || "Login failed. Check backend and credentials.");
      setToken(null); // Clear token on login failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to inspect products and monitor quality.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
        <label htmlFor="email" className="block">
          <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Email
          </span>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-required="true"
          />
        </label>
        <label htmlFor="password" className="block">
          <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Password
          </span>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-required="true"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-cyan-200 hover:text-cyan-100">Forgot password?</Link>
          <Link to="/signup" className="text-zinc-400 hover:text-white">Create account</Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Login"}</Button>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary">Google</Button>
          <Button type="button" variant="secondary">GitHub</Button>
        </div>
      </form>
    </AuthFrame>
  );
}

export default LoginPage;

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-950 px-4 py-10 text-white">
      <Panel className="relative w-full max-w-md p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-cyan-200">OptiVision AI</Link>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </Panel>
    </div>
  );
}
