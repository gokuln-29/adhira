-- Phase 6: Stripe Checkout Sessions need a place to record the session so the
-- webhook can find the order it belongs to, and so a repeat webhook delivery
-- is a no-op instead of double-processing.
alter table orders
  add column stripe_checkout_session_id text unique,
  add column stripe_payment_intent_id text;
