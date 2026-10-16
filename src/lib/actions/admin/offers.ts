"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offer_targets, offers } from "@/lib/db/schema";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";
import { offerInputSchema, type OfferInput } from "@/lib/validators/offer";

export type OfferFormInput = OfferInput;

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function parse(raw: OfferInput) {
  const parsed = offerInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Please check the offer." };
  return { ok: true as const, v: parsed.data };
}

const columns = (v: ReturnType<typeof offerInputSchema.parse>) => ({
  title: v.title,
  type: v.type,
  value: v.value,
  code: v.code,
  scope: v.scope,
  min_subtotal: v.min_subtotal,
  max_uses: v.max_uses,
  max_uses_per_customer: v.max_uses_per_customer,
  // Stored at midnight UTC of the picked day; only the date part is ever read.
  starts: v.starts ? `${v.starts}T00:00:00.000Z` : null,
  ends: v.ends ? `${v.ends}T00:00:00.000Z` : null,
  active: v.active,
});

async function writeTargets(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], offerId: string, v: ReturnType<typeof offerInputSchema.parse>) {
  await tx.delete(offer_targets).where(eq(offer_targets.offer_id, offerId));
  const rows =
    v.scope === "category"
      ? v.category_ids.map((id) => ({ offer_id: offerId, kind: "category" as const, target_id: id }))
      : v.scope === "product"
        ? v.product_ids.map((id) => ({ offer_id: offerId, kind: "product" as const, target_id: id }))
        : [];
  if (rows.length) await tx.insert(offer_targets).values(rows);
}

export async function createOffer(input: OfferInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const p = parse(input);
  if (!p.ok) return p;
  const id = newId();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(offers).values({ id, ...columns(p.v) });
      await writeTargets(tx, id, p.v);
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "offer") };
  }
  revalidatePath("/admin/offers");
  refreshStorefront();
  return { ok: true, id };
}

export async function updateOffer(id: string, input: OfferInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const p = parse(input);
  if (!p.ok) return p;
  try {
    await db.transaction(async (tx) => {
      await tx.update(offers).set(columns(p.v)).where(eq(offers.id, id));
      await writeTargets(tx, id, p.v);
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "offer") };
  }
  revalidatePath("/admin/offers");
  refreshStorefront();
  return { ok: true };
}

export async function deleteOffer(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    // Orders keep their coupon_code snapshot; the link to the offer is just cleared.
    await db.delete(offers).where(eq(offers.id, id));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "offer") };
  }
  revalidatePath("/admin/offers");
  refreshStorefront();
  return { ok: true };
}
