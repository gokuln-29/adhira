"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";

export interface OfferFormInput {
  title: string;
  type: "percent" | "flat" | "code";
  value: number;
  code: string | null;
  scope: string;
  starts: string | null;
  ends: string | null;
  active: boolean;
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function toColumns(input: OfferFormInput) {
  return {
    title: input.title.trim(),
    type: input.type,
    value: input.value,
    code: input.code?.trim() || null,
    scope: input.scope,
    starts: input.starts,
    ends: input.ends,
    active: input.active,
  };
}

export async function createOffer(input: OfferFormInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const id = newId();
  try {
    await db.insert(offers).values({ id, ...toColumns(input) });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "offer") };
  }
  revalidatePath("/admin/offers");
  refreshStorefront();
  return { ok: true, id };
}

export async function updateOffer(id: string, input: OfferFormInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    await db.update(offers).set(toColumns(input)).where(eq(offers.id, id));
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
    await db.delete(offers).where(eq(offers.id, id));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "offer") };
  }
  revalidatePath("/admin/offers");
  refreshStorefront();
  return { ok: true };
}
