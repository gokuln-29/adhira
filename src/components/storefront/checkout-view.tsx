"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatAED } from "@/lib/pricing";
import { quoteCoupon, type CouponQuote } from "@/lib/actions/coupons";
import { createOrder, type Emirate, type PaymentMethod } from "@/lib/actions/orders";
import { EMIRATES } from "@/lib/constants/emirates";
import { useDeliveryRules } from "@/lib/delivery/context";
import { addDays, dubaiNow, DELIVERY_SLOTS, earliestDate, isDeliverableDate, slotsFor, validateDelivery } from "@/lib/delivery/rules";

const SAVED_KEY = "fg_checkout_v1";
const SAVED_FIELDS = ["name", "email", "phone", "emirate", "line1", "line2", "area", "landmark", "company", "trn"] as const;

export function CheckoutView() {
  const t = useTranslations("Checkout");
  const tEmirates = useTranslations("Emirates");
  const { items, subtotal, vat, deposit, lines, valid } = useCart();
  const router = useRouter();
  const locale = useLocale();

  const slotLabels: Record<string, string> = {
    morning: t("slotMorning"),
    afternoon: t("slotAfternoon"),
    evening: t("slotEvening"),
  };
  const rules = useDeliveryRules();

  const paymentMethods: { value: PaymentMethod; label: string; available: boolean }[] = [
    { value: "card", label: t("cardLabel"), available: true },
  ];

  // Returning customers shouldn't retype everything: details from their last
  // order are kept in this browser only (never sent anywhere until checkout).
  const [init, setInit] = useState<{ saved: Record<string, string>; ready: boolean; now?: Date }>({
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
      now: new Date(),
    });
  }, []);
  const { saved, ready } = init;

  // Keep "now" fresh so the cut-off passing while the page is open updates the options.
  const [tick, setTick] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const now = tick ?? init.now ?? null;

  // Discount code (checked by the server; see lib/actions/coupons.ts).
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; title: string } | null>(null);
  const [quote, setQuote] = useState<Extract<CouponQuote, { ok: true }> | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const cartLines = items.map((i) => ({ productId: i.productId, qty: i.qty, vessel: i.vessel, months: i.months }));
  const cartKey = JSON.stringify(cartLines);
  const couponMessage = (r: Extract<CouponQuote, { ok: false }>) =>
    r.reason === "min_subtotal" && r.min != null
      ? t("coupon_min_subtotal", { min: formatAED(r.min) })
      : r.reason === "rate" || r.reason === "cart" || r.reason === "invalid" || r.reason === "not_started" || r.reason === "expired" || r.reason === "not_applicable" || r.reason === "used_up" || r.reason === "used_by_you"
        ? t(`coupon_${r.reason}`)
        : r.error;

  // Re-quote when the cart changes so the discount never goes stale.
  useEffect(() => {
    if (!applied) return;
    let live = true;
    quoteCoupon({ code: applied.code, items: JSON.parse(cartKey) }).then((r) => {
      if (!live) return;
      if (r.ok) setQuote(r);
      else {
        setApplied(null);
        setQuote(null);
        setCouponError(couponMessage(r));
      }
    });
    return () => {
      live = false;
    };
    // couponMessage only reads translations; re-running on its identity would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, cartKey]);

  async function applyCoupon() {
    setCouponBusy(true);
    setCouponError(null);
    const r = await quoteCoupon({ code: couponInput, items: cartLines });
    setCouponBusy(false);
    if (!r.ok) return setCouponError(couponMessage(r));
    setApplied({ code: r.code, title: r.title });
    setQuote(r);
    setCouponInput("");
  }

  const [emirateChoice, setEmirateChoice] = useState<string | null>(null);
  const emirate = emirateChoice ?? (saved.emirate || "Dubai");
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);

  // The same rule code the server runs as the authority (fees, cut-off, closed days, windows).
  const earliest = rules && now ? earliestDate(rules, emirate, now) : null;
  const date = chosenDate && earliest && chosenDate >= earliest ? chosenDate : (earliest ?? "");
  const slotOptions = rules && now && date ? slotsFor(rules, date, now) : [];
  const slot = slotOptions.some((s) => s.id === chosenSlot) ? chosenSlot! : (slotOptions[0]?.id ?? "");
  const check = rules && now ? validateDelivery(rules, { emirate, date, slot, goodsFils: Math.round(subtotal * 100) - (quote?.discountFils ?? 0) }, now) : null;
  const deliveryFee = check?.ok ? check.feeFils / 100 : 0;
  const deliveryVat = check?.ok ? check.vatFils / 100 : 0;
  // With a coupon the discount, and the VAT on what's left, come from the server's quote
  // (the same code that prices the order); otherwise the plain cart totals apply.
  const discount = quote ? quote.discountFils / 100 : 0;
  const goodsVat = quote ? quote.goodsVatFils / 100 : vat;
  const grandVat = goodsVat + deliveryVat;
  const grandTotal = subtotal - discount + goodsVat + deposit + deliveryFee + deliveryVat;
  const deliveryProblem = !check || check.ok
    ? null
    : check.code === "zone_disabled"
      ? t("noDelivery", { emirate: tEmirates(emirate) })
      : check.code === "slot_too_soon"
        ? t("slotTooSoon")
        : rules && date && !isDeliverableDate(rules, date)
          ? t("dateClosed")
          : t("noBooking");
  const maxDate = rules && now ? addDays(dubaiNow(now).date, rules.maxDaysAhead) : undefined;

  const [businessChoice, setBusinessChoice] = useState<boolean | null>(null);
  const isBusiness = businessChoice ?? !!saved.company;
  const [payment, setPayment] = useState<PaymentMethod>("card");
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
    if (deliveryProblem) {
      setError(deliveryProblem);
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
      deliveryDate: date,
      deliverySlot: slot as "morning" | "afternoon" | "evening",
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
      couponCode: applied?.code,
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
      window.location.assign(result.redirectUrl);
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
          <Select
            name="emirate"
            label={t("emirate")}
            required
            value={emirate}
            onChange={(e) => setEmirateChoice(e.target.value)}
            error={check && !check.ok && check.code === "zone_disabled" ? deliveryProblem ?? undefined : undefined}
          >
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
            <Input
              name="deliveryDate"
              type="date"
              required
              min={earliest ?? undefined}
              max={maxDate}
              value={date}
              onChange={(e) => setChosenDate(e.target.value)}
              label={t("deliveryDate")}
              hint={earliest ? t("deliveryDateHint", { date: new Date(`${earliest}T12:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }) }) : undefined}
              error={check && !check.ok && check.code !== "zone_disabled" ? deliveryProblem ?? undefined : undefined}
            />
            <Select name="deliverySlot" label={t("deliverySlot")} required value={slot} onChange={(e) => setChosenSlot(e.target.value)}>
              {(slotOptions.length > 0 ? slotOptions : DELIVERY_SLOTS).map((s) => (
                <option key={s.id} value={s.id}>
                  {slotLabels[s.id]}
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

        <Button type="submit" size="lg" disabled={submitting || !!deliveryProblem}>
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
        <div className="flex flex-col gap-2 border-b border-(--color-hairline) py-4">
          {applied ? (
            <div className="flex items-start justify-between gap-3 text-xs">
              <span className="text-(--color-primary)">{t("couponApplied", { code: applied.code, title: applied.title })}</span>
              <button
                type="button"
                className="shrink-0 font-mono-label text-[10px] text-(--color-muted) underline"
                onClick={() => {
                  setApplied(null);
                  setQuote(null);
                }}
              >
                {t("couponRemove")}
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t("coupon")}
                  placeholder={t("couponPlaceholder")}
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    // Enter must apply the code, not submit the whole order form.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponInput.trim()) void applyCoupon();
                    }
                  }}
                  autoComplete="off"
                />
              </div>
              <Button type="button" variant="secondary" disabled={couponBusy || !couponInput.trim()} onClick={() => void applyCoupon()}>
                {t("couponApply")}
              </Button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-700">{couponError}</p>}
        </div>
        <div className="flex flex-col gap-2 border-b border-(--color-hairline) py-4 font-mono-label text-xs">
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("subtotal")}</span>
            <span>{formatAED(subtotal)}</span>
          </div>
          {discount > 0 && applied && (
            <div className="flex justify-between text-(--color-primary)">
              <span>{t("discountRow", { code: applied.code })}</span>
              <span>−{formatAED(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("delivery")}</span>
            <span>{check?.ok ? (deliveryFee > 0 ? formatAED(deliveryFee) : t("free")) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("vat")}</span>
            <span>{formatAED(grandVat)}</span>
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
          <span>{formatAED(grandTotal)}</span>
        </div>
      </div>
    </form>
  );
}
