"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/input";
import { MonoLabel } from "@/components/ui/mono-label";
import { EMIRATES } from "@/lib/constants/emirates";

const sameDayEmirates = new Set(["Dubai", "Sharjah", "Ajman"]);

export function DeliveryEstimator() {
  const t = useTranslations("Pdp");
  const tEmirates = useTranslations("Emirates");
  const [emirate, setEmirate] = useState<(typeof EMIRATES)[number]>("Dubai");

  const estimate = sameDayEmirates.has(emirate)
    ? t("sameDayDelivery")
    : t("nextDayDelivery");

  return (
    <div className="border-t border-(--color-hairline) pt-4">
      <Select
        label={t("estimateDelivery")}
        value={emirate}
        onChange={(e) => setEmirate(e.target.value as (typeof EMIRATES)[number])}
      >
        {EMIRATES.map((e) => (
          <option key={e} value={e}>
            {tEmirates(e)}
          </option>
        ))}
      </Select>
      <MonoLabel as="p" className="mt-2 text-[11px]">
        {estimate}
      </MonoLabel>
    </div>
  );
}
