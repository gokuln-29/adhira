import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;

// Lazily constructed so the app still boots without a key set (checkout
// simply reports card payment as unavailable) — see isStripeConfigured().
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
