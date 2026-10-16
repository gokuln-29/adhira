"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { beginMfaEnrollment, changeOwnPassword, confirmMfaEnrollment } from "@/lib/actions/admin/auth";

export function SecurityPanel({ totpEnabled }: { totpEnabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    const res = await beginMfaEnrollment();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSetup({ secret: res.secret, qr: await QRCode.toDataURL(res.uri, { margin: 1, width: 192 }) });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await confirmMfaEnrollment(code);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSetup(null);
    setRecovery(res.recoveryCodes);
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPwMsg(null);
    const res = await changeOwnPassword(pw);
    setBusy(false);
    setPwMsg(res.ok ? { ok: true, text: "Password updated. Other sessions were signed out." } : { ok: false, text: res.error });
    if (res.ok) setPw({ current: "", next: "" });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        {recovery ? (
          <>
            <MonoLabel muted={false}>Save your recovery codes</MonoLabel>
            <p className="text-sm text-(--color-muted)">
              Each code works once if you lose your authenticator. They won&apos;t be shown again.
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
              {recovery.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        ) : totpEnabled ? (
          <p className="text-sm">Two-factor authentication is <b>on</b> for your account.</p>
        ) : setup ? (
          <form onSubmit={confirm} className="flex flex-col gap-4">
            <p className="text-sm text-(--color-muted)">
              Scan with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6-digit code.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Authenticator QR code" width={192} height={192} />
            <p className="font-mono text-xs break-all">{setup.secret}</p>
            <Input label="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" required />
            <Button type="submit" disabled={busy} className="w-fit">Turn on</Button>
          </form>
        ) : (
          <>
            <p className="text-sm text-(--color-muted)">Add a second step to your sign-in. Recommended for every account.</p>
            <Button onClick={begin} disabled={busy} className="w-fit">Set up two-factor</Button>
          </>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </Card>

      <form onSubmit={savePassword} className="flex flex-col gap-4">
        <MonoLabel muted={false}>Change password</MonoLabel>
        <Input type="password" label="Current password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <Input type="password" label="New password (12+ characters, letters and numbers)" autoComplete="new-password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-(--color-primary)" : "text-red-700"}`}>{pwMsg.text}</p>}
        <Button type="submit" disabled={busy} className="w-fit">Update password</Button>
      </form>
    </div>
  );
}
