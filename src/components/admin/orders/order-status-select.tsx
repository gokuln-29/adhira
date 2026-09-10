"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { updateOrderStatus } from "@/lib/actions/admin/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants/order";

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
        await updateOrderStatus(number, e.target.value as OrderStatus);
        setSaving(false);
        router.refresh();
      }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ").toUpperCase()}
        </option>
      ))}
    </Select>
  );
}
