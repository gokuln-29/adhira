"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestAdminPasswordReset } from "@/lib/actions/admin/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestAdminPasswordReset(email);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas) px-6">
      <div className="w-full max-w-sm">
        <span className="font-logo text-lg">Adhira Flowers</span>
        <h1 className="font-display mt-4 text-4xl">Forgot password</h1>
        {sent ? (
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <p>If that address belongs to an admin account, a reset link is on its way. It works once and expires in 30 minutes.</p>
            <Link className="underline underline-offset-4" href="/admin/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Input type="email" label="Admin email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Email me a reset link"}
            </Button>
            <Link className="text-sm text-(--color-muted) underline underline-offset-4" href="/admin/login">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
