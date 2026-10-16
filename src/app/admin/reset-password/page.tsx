"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { checkAdminResetToken, completeAdminPasswordReset } from "@/lib/actions/admin/password-reset";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"checking" | "ready" | "dead" | "done">("checking");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    checkAdminResetToken(token).then((r) => {
      if (!live) return;
      setNeedsMfa(r.needsMfa);
      setState(r.valid ? "ready" : "dead");
    });
    return () => {
      live = false;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const res = await completeAdminPasswordReset({ token, password, mfaCode: needsMfa ? code : undefined });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setState("done");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas) px-6">
      <div className="w-full max-w-sm">
        <span className="font-logo text-lg">Adhira Flowers</span>
        <h1 className="font-display mt-4 text-4xl">Reset password</h1>
        {state === "checking" && <p className="mt-6 text-sm text-(--color-muted)">Checking your link...</p>}
        {state === "dead" && (
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <p>This link has expired or was already used.</p>
            <Link className="underline underline-offset-4" href="/admin/forgot-password">
              Request a new link
            </Link>
          </div>
        )}
        {state === "done" && (
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <p>Your password was changed and all sessions were signed out.</p>
            <Link className="underline underline-offset-4" href="/admin/login">
              Sign in
            </Link>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Input
              type="password"
              label="New password (12+ characters, letters and numbers)"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="password"
              label="Repeat new password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {needsMfa && (
              <Input
                label="Authenticator code or recovery code"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Set new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
