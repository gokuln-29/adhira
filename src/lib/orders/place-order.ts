import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { customers, order_items, order_status_events, orders, products } from "@/lib/db/schema";
import { isDuplicateKey, newId } from "@/lib/db/helpers";
import { priceLine, type LineSelection } from "@/lib/pricing";
import { validateDelivery, type DeliveryRules } from "@/lib/delivery/rules";
import type { ValidatedOrderInput } from "@/lib/validators/order";

export interface PlacedLine {
  productId: string;
  name: string;
  nameAr: string | null;
  vatRate: number;
  qty: number;
  vesselUnitFils: number;
  unitFils: number;
  lineFils: number;
  vatFils: number;
  depositFils: number;
  vesselFils: number;
  vessel: boolean;
  isRental: boolean;
  months: number;
}

export type PlaceOrderResult =
  | {
      ok: true;
      // true when this idempotency key had already produced an order.
      replay: boolean;
      order: {
        id: string;
        number: string;
        public_token: string;
        status: string;
        payment_method: string;
        stripe_checkout_session_id: string | null;
      };
      lines: PlacedLine[];
      vatFils: number;
      depositFils: number;
      deliveryFils: number;
    }
  | { ok: false; reason: "unavailable" | "rule" | "stock" | "delivery"; message: string };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function orderNumber(): string {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }).slice(2).replaceAll("-", "");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `AF-${date}-${suffix}`;
}

class Reject extends Error {
  constructor(
    public reason: "unavailable" | "rule" | "stock" | "delivery",
    message: string,
  ) {
    super(message);
  }
}

async function upsertCustomer(tx: Tx, c: ValidatedOrderInput["customer"]): Promise<string> {
  const email = c.email.trim();
  const existing = await tx.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
  if (existing[0]) return existing[0].id;
  const id = newId();
  try {
    await tx.insert(customers).values({
      id,
      name: c.name.trim(),
      email,
      phone: c.phone.trim() || null,
      company: c.company?.trim() || null,
      trn: c.trn?.trim() || null,
      type: c.company?.trim() ? "corporate" : "retail",
    });
    return id;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    // A locking read is a "current read": under REPEATABLE READ a plain SELECT
    // would keep returning this transaction's old snapshot (without the row
    // another request just committed).
    const again = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1)
      .for("share");
    return again[0]!.id;
  }
}

/**
 * Prices and persists an order in ONE transaction. Product rows are locked
 * (`FOR UPDATE`, in id order to avoid deadlocks), so two simultaneous checkouts
 * of the last item serialise and the second is rejected instead of overselling.
 * Everything money-related is read from the database here, never the browser.
 */
export async function placeOrder(
  input: ValidatedOrderInput,
  pickById: Map<string, LineSelection>,
  idempotencyKey: string | null,
  notes: string | null,
  deliveryRules: DeliveryRules,
  now: Date = new Date(),
): Promise<PlaceOrderResult> {
  try {
    return await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const prior = await tx
          .select({
            id: orders.id,
            number: orders.number,
            public_token: orders.public_token,
            status: orders.status,
            payment_method: orders.payment_method,
            stripe_checkout_session_id: orders.stripe_checkout_session_id,
          })
          .from(orders)
          .where(eq(orders.idempotency_key, idempotencyKey))
          .limit(1);
        if (prior[0]) return { ok: true as const, replay: true, order: prior[0], lines: [], vatFils: 0, depositFils: 0, deliveryFils: 0 };
      }

      const ids = [...pickById.keys()].sort();
      const rows = await tx
        .select()
        .from(products)
        .where(and(inArray(products.id, ids), eq(products.status, "active")))
        .orderBy(products.id)
        .for("update");
      if (rows.length !== ids.length) {
        throw new Reject("unavailable", "Some items in your cart are no longer available. Please review your cart.");
      }

      const lines: PlacedLine[] = [];
      for (const p of rows) {
        const selection = pickById.get(p.id)!;
        const priced = priceLine(
          {
            base_price: p.base_price,
            discount_type: p.discount_type,
            discount_value: p.discount_value,
            sale_start: p.sale_start,
            sale_end: p.sale_end,
            vat_rate: p.vat_rate,
            min_order_qty: p.min_order_qty,
            min_order_value: p.min_order_value,
            allows_vessel: p.allows_vessel,
            vessel_price: p.vessel_price,
            vessel_deposit: p.vessel_deposit,
            is_rental: p.is_rental,
            rental_monthly_price: p.rental_monthly_price,
            rental_min_months: p.rental_min_months,
            rental_deposit: p.rental_deposit,
          },
          selection,
        );
        const problem = priced.problems[0];
        if (problem) {
          const msg =
            problem.code === "min_qty"
              ? `minimum quantity is ${problem.min}.`
              : problem.code === "min_months"
                ? `minimum rental is ${problem.min} months.`
                : `minimum order value is AED ${problem.min.toFixed(2)}.`;
          throw new Reject("rule", `${p.name}: ${msg}`);
        }

        const qty = Math.max(1, selection.qty);
        if (p.stock_qty !== null) {
          if (p.stock_qty < qty) {
            throw new Reject("stock", `${p.name}: only ${p.stock_qty} left in stock.`);
          }
          await tx
            .update(products)
            .set({ stock_qty: sql`${products.stock_qty} - ${qty}` })
            .where(eq(products.id, p.id));
        }

        lines.push({
          productId: p.id,
          name: p.name,
          nameAr: p.name_ar,
          vatRate: p.vat_rate,
          qty,
          vesselUnitFils: priced.vessel ? Math.round(p.vessel_price * 100) : 0,
          ...priced,
        });
      }

      const subtotalFils = lines.reduce((s, l) => s + l.lineFils, 0);
      const depositFils = lines.reduce((s, l) => s + l.depositFils, 0);

      // Fee, cut-off, closed days and time window are all decided here from the
      // database rules, never from what the browser displayed.
      const delivery = validateDelivery(
        deliveryRules,
        { emirate: input.emirate, date: input.deliveryDate, slot: input.deliverySlot, goodsFils: subtotalFils },
        now,
      );
      if (!delivery.ok) throw new Reject("delivery", delivery.message);
      const deliveryFils = delivery.feeFils;
      const deliveryVatFils = delivery.vatFils;
      // Delivery is a taxable supply: its VAT is part of the order's VAT.
      const vatFils = lines.reduce((s, l) => s + l.vatFils, 0) + deliveryVatFils;
      // Deposits are refundable and outside the VAT base, but part of what is charged.
      const totalFils = subtotalFils + vatFils + depositFils + deliveryFils;

      const customerId = await upsertCustomer(tx, input.customer);
      const orderId = newId();
      const publicToken = newId();

      let number = orderNumber();
      for (let attempt = 0; ; attempt++) {
        try {
          await tx.insert(orders).values({
            id: orderId,
            number,
            public_token: publicToken,
            idempotency_key: idempotencyKey,
            customer_id: customerId,
            channel: input.customer.company ? "corporate" : "retail",
            status: "pending",
            payment_method: "card",
            payment_status: "unpaid",
            subtotal: subtotalFils / 100,
            vat: vatFils / 100,
            delivery_fee: deliveryFils / 100,
            delivery_vat: deliveryVatFils / 100,
            deposit_total: depositFils / 100,
            deposit_status: depositFils > 0 ? "held" : "none",
            total: totalFils / 100,
            currency: "AED",
            emirate: input.emirate,
            address: input.address,
            delivery_date: input.deliveryDate ?? null,
            notes,
          });
          break;
        } catch (err) {
          // Only a clash on the human-readable number is retryable.
          if (!isDuplicateKey(err) || attempt >= 5 || /idempotency|public_token/.test(String((err as Error).message))) throw err;
          number = orderNumber();
        }
      }

      await tx.insert(order_items).values(
        lines.map((l) => ({
          id: newId(),
          order_id: orderId,
          product_id: l.productId,
          name: l.name,
          name_ar: l.nameAr,
          qty: l.qty,
          unit_price: l.unitFils / 100,
          line_total: l.lineFils / 100,
          vat_rate: l.vatRate,
          vat: l.vatFils / 100,
          vessel: l.vessel,
          vessel_fee: l.vesselFils / 100,
          deposit: l.depositFils / 100,
          rental_months: l.isRental ? l.months : null,
        })),
      );
      await tx.insert(order_status_events).values({
        id: newId(),
        order_id: orderId,
        kind: "status",
        from_value: null,
        to_value: "pending",
        actor: "customer",
        note: `placed (${input.paymentMethod})`,
      });

      return {
        ok: true as const,
        replay: false,
        order: {
          id: orderId,
          number,
          public_token: publicToken,
          status: "pending",
          payment_method: "card",
          stripe_checkout_session_id: null,
        },
        lines,
        vatFils,
        depositFils,
        deliveryFils,
      };
    });
  } catch (err) {
    if (err instanceof Reject) return { ok: false, reason: err.reason, message: err.message };
    // Two requests with the same idempotency key racing: the loser re-reads.
    if (idempotencyKey && isDuplicateKey(err)) {
      const prior = await db
        .select({
          id: orders.id,
          number: orders.number,
          public_token: orders.public_token,
          status: orders.status,
          payment_method: orders.payment_method,
          stripe_checkout_session_id: orders.stripe_checkout_session_id,
        })
        .from(orders)
        .where(eq(orders.idempotency_key, idempotencyKey))
        .limit(1);
      if (prior[0]) return { ok: true, replay: true, order: prior[0], lines: [], vatFils: 0, depositFils: 0, deliveryFils: 0 };
    }
    throw err;
  }
}
