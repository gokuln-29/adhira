# Tabby / Tamara (BNPL) — scaffold only

Not implemented. Both are surfaced in `[locale]/checkout/page.tsx` as disabled
payment-method options ("coming soon"), and `PaymentMethod` in
`lib/actions/orders.ts` already includes `"tabby" | "tamara"` so the type
doesn't need to change when this lands. `.env.example` has the expected env
vars (`TABBY_SECRET_KEY`, `TABBY_PUBLIC_KEY`, `TABBY_MERCHANT_CODE`,
`TAMARA_API_TOKEN`, `TAMARA_NOTIFICATION_TOKEN`).

To wire a real integration, follow the same shape as the Stripe card flow in
`createOrder()`:

1. Create the order row first (status `pending`), same as today.
2. Call the provider's session/checkout-creation API with the order total and
   `success_url`/`cancel_url` (or `failure_url`) pointing at
   `/{locale}/order-confirmation/{orderNumber}` and `/{locale}/checkout`.
3. Store the provider's session/order reference on the `orders` row (add a
   migration for it, the way `stripe_checkout_session_id` was added) so a
   webhook can find its way back to the order.
4. Add a webhook route under `src/app/api/<provider>/webhook/route.ts` — copy
   `src/app/api/stripe/webhook/route.ts`'s shape: verify the signature/token
   the provider sends, then update `orders.status` guarded by
   `.eq("status", "pending")` so a duplicate delivery can't regress an order
   that moved on.
5. Flip `available: true` for that method in the `paymentMethods` array in
   `[locale]/checkout/page.tsx`.

Tabby and Tamara both require a merchant approval process before their test
credentials work, which is why this stayed scaffolding rather than a build
against a real (if unused) sandbox account.
