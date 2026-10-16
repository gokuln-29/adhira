"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatAED } from "@/lib/pricing";
import { createOrder, type Emirate, type PaymentMethod } from "@/lib/actions/orders";
import { EMIRATES } from "@/lib/constants/emirates";

const SAVED_KEY = "fg_checkout_v1";
const SAVED_FIELDS = ["name", "email", "phone", "emirate", "line1", "line2", "area", "landmark", "company", "trn"] as const;

export function CheckoutView() {
  const t = useTranslations("Checkout");
  const tEmirates = useTranslations("Emirates");
  const { items, subtotal, vat, deposit, total, lines, valid } = useCart();
  const router = useRouter();
  const locale = useLocale();

  const slots: { value: string; label: string }[] = [
    { value: "Morning (9am - 12pm)", label: t("slotMorning") },
    { value: "Afternoon (12pm - 4pm)", label: t("slotAfternoon") },
    { value: "Evening (4pm - 8pm)", label: t("slotEvening") },
  ];

  const paymentMethods: { value: PaymentMethod; label: string; available: boolean }[] = [
    { value: "cod", label: t("codLabel"), available: true },
    { value: "card", label: t("cardLabel"), available: true },
  ];

  // Returning customers shouldn't retype everything: details from their last
  // order are kept in this browser only (never sent anywhere until checkout).
  const [init, setInit] = useState<{ saved: Record<string, string>; ready: boolean; minDate?: string }>({
    saved: {},
    ready: false,
  });
  useEffect(() => {
    let saved: Record<string, string> = {};
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (raw) saved = JSON.parse(raw) as Record<string, string>;
    } catch {
      // storage unavailable: just start with an empty form
    }
    // Read in the browser only, so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInit({
      saved,
      ready: true,
      minDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
    });
  }, []);
  const { saved, ready, minDate } = init;

  const [businessChoice, setBusinessChoice] = useState<boolean | null>(null);
  const isBusiness = businessChoice ?? !!saved.company;
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [submitting, setSubmitting] = useState(false);
  // One key per submit attempt: a double-click or retry of the same attempt
  // returns the same order. Regenerated after a failure so a corrected retry is new.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  // Plain onSubmit + preventDefault, not the `action` prop: React 19 resets
  // uncontrolled form fields once a form-action's promise *settles*, even
  // when it resolves to { ok: false } rather than throwing — so a checkout
  // error (e.g. an unconfigured payment method) would silently wipe every
  // field the customer just filled in. onSubmit has no such auto-reset.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!valid) {
      setError(t("fixMinimums"));
      return;
    }
    setError(null);
    setSubmitting(true);

    const result = await createOrder({
      customer: {
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        phone: String(formData.get("phone") || ""),
        company: isBusiness ? String(formData.get("company") || "") : undefined,
        trn: isBusiness ? String(formData.get("trn") || "") : undefined,
      },
      emirate: formData.get("emirate") as Emirate,
      address: {
        line1: String(formData.get("line1") || ""),
        line2: String(formData.get("line2") || "") || undefined,
        area: String(formData.get("area") || "") || undefined,
        landmark: String(formData.get("landmark") || "") || undefined,
      },
      deliveryDate: String(formData.get("deliveryDate") || "") || undefined,
      deliverySlot: String(formData.get("deliverySlot") || "") || undefined,
      giftMessage: String(formData.get("giftMessage") || "") || undefined,
      poNumber: isBusiness ? String(formData.get("poNumber") || "") || undefined : undefined,
      paymentMethod: payment,
      // Only WHICH products and HOW MANY: the server prices the order itself.
      items: items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        vessel: item.vessel,
        months: item.months,
      })),
      locale: locale as "en" | "ar",
      idempotencyKey: attemptKey,
      // The server re-checks this; the cast only satisfies the literal `true` type.
      acceptTerms: (formData.get("acceptTerms") === "on") as true,
    });

    if (!result.ok) {
      setSubmitting(false);
      setAttemptKey(crypto.randomUUID());
      setError(result.error);
      return;
    }

    try {
      const toSave: Record<string, string> = {};
      for (const field of SAVED_FIELDS) toSave[field] = String(formData.get(field) || "");
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(toSave));
    } catch {
      // ignore storage errors
    }

    if (result.redirectUrl) {
      // Full navigation to Stripe's hosted page — the cart is cleared on
      // the confirmation page, not here, so a cancelled payment leaves it
      // intact for the buyer to try again.
      window.location.href = result.redirectUrl;
      return;
    }

    router.push(`/order-confirmation/${result.token}`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <MonoLabel muted={false}>{t("emptyCart")}</MonoLabel>
      </div>
    );
  }

  return (
    <form
      // Remount once saved details are loaded so the fields pick up their defaults.
      key={ready ? "ready" : "loading"}
      onSubmit={handleSubmit}
      className="mx-auto grid max-w-7xl gap-12 px-6 py-14 md:py-20 lg:grid-cols-3 lg:gap-16"
    >
      <div className="flex flex-col gap-12 lg:col-span-2">
        <h1 className="font-display text-5xl md:text-6xl">{t("title")}</h1>

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-3 font-display text-3xl">{t("contact")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="name" label={t("fullName")} required autoComplete="name" defaultValue={saved.name} />
            <Input
              name="email"
              type="email"
              defaultValue={saved.email}
              label={t("email")}
              required
              autoComplete="email"
            />
          </div>
          <Input name="phone" type="tel" label={t("phone")} required autoComplete="tel" defaultValue={saved.phone} />
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-3 font-display text-3xl">{t("deliveryAddress")}</legend>
          <Select name="emirate" label={t("emirate")} required defaultValue={saved.emirate || "Dubai"}>
            {EMIRATES.map((e) => (
              <option key={e} value={e}>
                {tEmirates(e)}
              </option>
            ))}
          </Select>
          <Input name="line1" label={t("addressLine1")} required autoComplete="address-line1" defaultValue={saved.line1} />
          <details className="group" open={!!(saved.line2 || saved.area || saved.landmark)}>
            <summary className="cursor-pointer font-mono-label text-[11px] text-(--color-primary)">
              {t("moreAddress")}
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="line2" label={t("addressLine2")} defaultValue={saved.line2} />
                <Input name="area" label={t("area")} defaultValue={saved.area} />
              </div>
              <Input name="landmark" label={t("landmark")} defaultValue={saved.landmark} />
            </div>
          </details>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="deliveryDate" type="date" min={minDate} label={t("deliveryDate")} hint={t("deliveryDateHint")} />
            <Select name="deliverySlot" label={t("deliverySlot")}>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <details>
            <summary className="cursor-pointer font-mono-label text-[11px] text-(--color-primary)">
              {t("addGiftMessage")}
            </summary>
            <div className="mt-4">
              <Textarea name="giftMessage" label={t("giftMessage")} rows={3} />
            </div>
          </details>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <label className="flex items-center gap-2 font-mono-label text-[11px] text-(--color-muted)">
            <input
              type="checkbox"
              checked={isBusiness}
              onChange={(e) => setBusinessChoice(e.target.checked)}
            />
            {t("businessOrder")}
          </label>
          {isBusiness && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input name="company" label={t("companyName")} defaultValue={saved.company} />
              <Input name="trn" label={t("trn")} defaultValue={saved.trn} />
              <Input name="poNumber" label={t("poNumber")} />
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-display text-3xl">{t("payment")}</legend>
          {paymentMethods.map((method) => (
            <label
              key={method.value}
              className={`flex items-center gap-3 border border-(--color-hairline) px-4 py-3 text-sm ${
                method.available ? "" : "opacity-50"
              }`}
            >
              <input
                type="radio"
                name="payment"
                value={method.value}
                checked={payment === method.value}
                disabled={!method.available}
                onChange={() => setPayment(method.value)}
              />
              {method.label}
              {!method.available && (
                <MonoLabel className="ms-auto text-[10px]">{t("comingSoon")}</MonoLabel>
              )}
            </label>
          ))}
        </fieldset>

        {error && (
          <p className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-(--color-primary)" />
          <span>
            {t.rich("acceptTerms", {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" className="underline hover:text-(--color-primary)">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" className="underline hover:text-(--color-primary)">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? t("placingOrder") : t("placeOrder")}
        </Button>
      </div>

      <div className="h-fit border border-(--color-hairline) bg-(--color-surface) p-8 lg:sticky lg:top-24">
        <MonoLabel as="p" muted={false} className="mb-4">
          {t("orderSummary")}
        </MonoLabel>
        <div className="flex flex-col gap-3 border-b border-(--color-hairline) pb-4">
          {items.map((item) => {
            const line = lines[item.productId];
            const isRental = item.is_rental && (item.rental_monthly_price ?? 0) > 0;
            return (
              <div key={item.productId} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.name} <span className="text-(--color-muted)">×{item.qty}</span>
                  {isRental && (
                    <span className="block text-xs text-(--color-muted)">
                      {t("rentalMonths", { months: item.months })}
                    </span>
                  )}
                  {item.vessel && (
                    <span className="block text-xs text-(--color-muted)">{t("withVessel")}</span>
                  )}
                </span>
                <MonoLabel muted={false} className="whitespace-nowrap">
                  {formatAED((line?.goods ?? 0) + (line?.vessel ?? 0))}
                </MonoLabel>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 border-b border-(--color-hairline) py-4 font-mono-label text-xs">
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("subtotal")}</span>
            <span>{formatAED(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("vat")}</span>
            <span>{formatAED(vat)}</span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between">
              <span className="text-(--color-muted)">{t("deposit")}</span>
              <span>{formatAED(deposit)}</span>
            </div>
          )}
        </div>
        {deposit > 0 && <p className="pt-3 text-xs text-(--color-muted)">{t("depositNote")}</p>}
        <div className="flex justify-between pt-4 font-mono-label text-sm">
          <span>{t("total")}</span>
          <span>{formatAED(total)}</span>
        </div>
      </div>
    </form>
  );
}
