"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { updateOrderStatus } from "@/lib/actions/admin/orders";
import { ORDER_TRANSITIONS, type OrderStatus } from "@/lib/constants/order";

export function OrderStatusSelect({
  number,
  status,
}: {
  number: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <Select
      label="Status"
      value={status}
      disabled={saving}
      onChange={async (e) => {
        setSaving(true);
        const res = await updateOrderStatus(number, e.target.value as OrderStatus);
        setSaving(false);
        if (!res.ok) alert(res.error);
        router.refresh();
      }}
    >
      {[status, ...ORDER_TRANSITIONS[status]].map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ").toUpperCase()}
        </option>
      ))}
    </Select>
  );
}
