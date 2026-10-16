"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminLogin, adminVerifyMfa } from "@/lib/actions/admin/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (step === "password") {
      const res = await adminLogin({ email, password });
      if (!res.ok) {
        setSubmitting(false);
        // Same message whether the email or the password was wrong, so the form
        // can't be used to discover which staff emails exist.
        return setError(res.error);
      }
      if (res.needsMfa) {
        setSubmitting(false);
        return setStep("mfa");
      }
    } else {
      const res = await adminVerifyMfa(code);
      if (!res.ok) {
        setSubmitting(false);
        return setError(res.error);
      }
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas) px-6">
      <div className="w-full max-w-sm">
        <span className="font-logo text-lg">Adhira Flowers</span>
        <h1 className="font-display mt-4 text-4xl">{step === "mfa" ? "Two-step check" : "Admin sign in"}</h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {step === "password" ? (
            <>
              <Input
                type="email"
                label="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
              <Input
                type="password"
                label="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </>
          ) : (
            <Input
              label="Authenticator code or recovery code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
            />
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Checking..." : step === "mfa" ? "Verify" : "Sign in"}
          </Button>
          {step === "password" && (
            <Link className="text-sm text-(--color-muted) underline underline-offset-4" href="/admin/forgot-password">
              Forgot password?
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
