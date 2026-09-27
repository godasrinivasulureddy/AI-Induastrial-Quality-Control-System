import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, UserRound } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("engineer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }, [password]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/signup", { email, username, password, role });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Signup failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface-950 px-4 py-10 text-white">
      <Panel className="w-full max-w-lg p-6">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-200">OptiVision AI</Link>
        <h1 className="text-3xl font-semibold">Create workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Register an operator profile connected to the FastAPI database.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error ? <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="username">
              <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Username
              </span>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                aria-required="true"
              />
            </label>
            <label htmlFor="role">
              <span className="mb-2 block text-sm text-zinc-300">Role</span>
              <select
                id="role"
                className="h-11 w-full rounded-md border border-white/10 bg-white/7 px-3 text-sm outline-none"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                aria-label="Select operator role"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="engineer">Engineer</option>
              </select>
            </label>
          </div>
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
            <span className="mb-2 block text-sm text-zinc-300">Password</span>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-required="true"
                aria-describedby="password-strength-bar"
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
            <div
              id="password-strength-bar"
              role="progressbar"
              aria-label="Password strength"
              aria-valuenow={strength}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2 rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${strength}%` }} />
            </div>
          </label>
          <label htmlFor="confirm-password" className="block">
            <span className="mb-2 block text-sm text-zinc-300">Confirm password</span>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              aria-required="true"
            />
          </label>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
          <p className="text-center text-sm text-zinc-400">
            Already registered? <Link to="/login" className="text-cyan-200">Login</Link>
          </p>
        </form>
      </Panel>
    </div>
  );
}
export default SignupPage;