import "server-only";
import { and, asc, eq, inArray, isNull, like, lte, isNotNull } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { ops_alerts, products, store_settings } from "@/lib/db/schema";
import { CATALOG_TAG } from "@/lib/data/products";
import { autoResolveAlerts, raiseAlert } from "@/lib/ops/alerts";
import { stockStatus } from "@/lib/stock";

export async function getLowStockThreshold(): Promise<number> {
  const row = (await db.select({ t: store_settings.low_stock_threshold }).from(store_settings).limit(1))[0];
  return row?.t ?? 5;
}

export interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  stock_qty: number;
  status: "out" | "low";
}

/** Live products whose tracked stock is at or below the threshold, emptiest first. */
export async function getLowStockProducts(): Promise<{ threshold: number; items: LowStockProduct[] }> {
  const threshold = await getLowStockThreshold();
  const rows = await db
    .select({ id: products.id, name: products.name, slug: products.slug, stock_qty: products.stock_qty })
    .from(products)
    .where(and(eq(products.status, "active"), isNotNull(products.stock_qty), lte(products.stock_qty, threshold)))
    .orderBy(asc(products.stock_qty), asc(products.name));
  return {
    threshold,
    items: rows.map((r) => ({ ...r, stock_qty: r.stock_qty as number, status: (r.stock_qty as number) <= 0 ? "out" : "low" })),
  };
}

/** Product pages show stock, so make the next visit see the new number. Never throws. */
export function refreshStockPages(): void {
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch {
    // outside a request (scripts/tests): nothing to refresh
  }
}

/**
 * Brings the open stock alerts in line with reality for these products: raise "low" or
 * "out" once per episode (one email), clear whichever no longer applies. Safe to call
 * often (it skips products whose alert is already open) and never throws.
 */
export async function syncStockAlerts(productIds?: string[]): Promise<void> {
  try {
    const threshold = await getLowStockThreshold();
    const rows = await db
      .select({ id: products.id, name: products.name, status: products.status, stock_qty: products.stock_qty })
      .from(products)
      .where(productIds ? inArray(products.id, productIds) : isNotNull(products.stock_qty));
    const open = await db
      .select({ ref: ops_alerts.ref })
      .from(ops_alerts)
      .where(and(isNull(ops_alerts.resolved_at), like(ops_alerts.ref, "stock:%")));
    const openRefs = new Set(open.map((o) => o.ref));

    for (const p of rows) {
      const st = p.status === "active" ? stockStatus(p.stock_qty, threshold) : "untracked";
      const lowRef = `stock:low:${p.id}`;
      const outRef = `stock:out:${p.id}`;
      if (st !== "low" && openRefs.has(lowRef)) await autoResolveAlerts("low_stock", lowRef);
      if (st !== "out" && openRefs.has(outRef)) await autoResolveAlerts("out_of_stock", outRef);
      if (st === "low" && !openRefs.has(lowRef)) {
        await raiseAlert({
          kind: "low_stock",
          ref: lowRef,
          severity: "warning",
          title: `Low stock: ${p.name} (${p.stock_qty} left)`,
          details: `${p.name} is down to ${p.stock_qty} (alert level ${threshold}). Restock it, or set the units in the product page.`,
          link: `/admin/products/${p.id}`,
        });
      } else if (st === "out" && !openRefs.has(outRef)) {
        await raiseAlert({
          kind: "out_of_stock",
          ref: outRef,
          severity: "critical",
          title: `Out of stock: ${p.name}`,
          details: `${p.name} has 0 units left and can't be ordered until you add stock in the product page.`,
          link: `/admin/products/${p.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[stock] alert sync failed", err);
  }
}
