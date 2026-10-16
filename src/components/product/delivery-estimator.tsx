"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/input";
import { MonoLabel } from "@/components/ui/mono-label";
import { EMIRATES } from "@/lib/constants/emirates";
import { useDeliveryRules } from "@/lib/delivery/context";
import { earliestDate, formatCutoff, sameDayAvailable, zoneFor } from "@/lib/delivery/rules";

export function DeliveryEstimator() {
  const t = useTranslations("Pdp");
  const tEmirates = useTranslations("Emirates");
  const locale = useLocale();
  const rules = useDeliveryRules();
  const [emirate, setEmirate] = useState<(typeof EMIRATES)[number]>("Dubai");
  // Time is read in the browser only, so the server render and first client render match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  let estimate = "";
  if (rules && now) {
    const zone = zoneFor(rules, emirate);
    if (!zone?.enabled) estimate = t("noDelivery");
    else if (sameDayAvailable(rules, emirate, now)) estimate = t("sameDayDelivery", { cutoff: formatCutoff(rules.sameDayCutoff, locale) });
    else {
      const d = earliestDate(rules, emirate, now);
      estimate = d
        ? t("nextDayDelivery", {
            date: new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB", {
              timeZone: "UTC",
              weekday: "short",
              day: "numeric",
              month: "short",
            }),
          })
        : t("noDelivery");
    }
  }

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
      <MonoLabel as="p" className="mt-2 min-h-4 text-[11px]">
        {estimate}
      </MonoLabel>
    </div>
  );
}
