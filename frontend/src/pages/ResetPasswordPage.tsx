import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post<{ message: string }>("/auth/reset-password", { email, token, password });
      setMessage(response.data.message);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface-950 px-4 text-white">
      <Panel className="w-full max-w-md p-6">
        <h1 className="text-3xl font-semibold">Set new password</h1>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {message ? <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">{message}</div> : null}
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input placeholder="Reset token" value={token} onChange={(event) => setToken(event.target.value)} required />
          <Input type="password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <Button className="w-full" disabled={loading}>{loading ? "Updating..." : "Update password"}</Button>
        </form>
        <Link to="/login" className="mt-5 inline-block text-sm text-cyan-200">Back to login</Link>
      </Panel>
    </div>
  );
}
