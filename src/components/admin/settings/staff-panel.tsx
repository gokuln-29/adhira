"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { addStaffMember, removeStaffMember } from "@/lib/actions/admin/staff";
import type { StaffRow } from "@/lib/data/admin/staff";

export function StaffPanel({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "staff">("staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    const result = await addStaffMember({ email, password, name, role });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>Add staff member</MonoLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Temporary password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </Select>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="button" disabled={saving} onClick={handleAdd} className="w-fit">
          {saving ? "Adding..." : "Add staff member"}
        </Button>
      </Card>

      <Card className="divide-y divide-(--color-hairline)">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm">{s.name}</p>
              <MonoLabel className="text-[10px]">{s.role}</MonoLabel>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Remove ${s.name}'s admin access?`)) return;
                await removeStaffMember(s.id);
                router.refresh();
              }}
              className="font-mono-label text-[10px] text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
