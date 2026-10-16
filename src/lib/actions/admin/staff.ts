"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { admin_users } from "@/lib/db/schema";
import { isDuplicateKey, newId } from "@/lib/db/helpers";
import { authorize, type AdminRole } from "@/lib/admin/auth";
import { hashPassword } from "@/lib/auth/password";
import { revokeAdminSessions } from "@/lib/auth/admin-session";
import { staffInputSchema } from "@/lib/validators/staff";

type ActionResult = { ok: true } | { ok: false; error: string };

// Owner-only; enforced here explicitly (there is no row-level security).
export async function addStaffMember(input: {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}): Promise<ActionResult> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;

  const parsed = staffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }
  const { email, password, name, role } = parsed.data;

  try {
    await db.insert(admin_users).values({
      id: newId(),
      email: email.toLowerCase(),
      name,
      role,
      password_hash: await hashPassword(password),
    });
  } catch (err) {
    if (isDuplicateKey(err)) return { ok: false, error: "An admin with that email already exists." };
    console.error("[addStaffMember] insert failed", err);
    return { ok: false, error: "Couldn't add that staff member. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeStaffMember(id: string): Promise<ActionResult> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  if (auth.admin.id === id) {
    return { ok: false, error: "You can't remove your own access." };
  }

  try {
    // The DB trigger also refuses to remove the last owner.
    await db.delete(admin_users).where(eq(admin_users.id, id));
  } catch (err) {
    console.error("[removeStaffMember] delete failed", err);
    return { ok: false, error: "Couldn't remove that staff member." };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

// For a colleague who lost their authenticator: clears MFA and signs them out
// everywhere, so they sign in with their password and enrol again.
export async function resetStaffMfa(id: string): Promise<ActionResult> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  await db
    .update(admin_users)
    .set({ totp_enabled: false, totp_secret: null, totp_last_step: null, recovery_codes: null })
    .where(eq(admin_users.id, id));
  await revokeAdminSessions(id);
  revalidatePath("/admin/settings");
  return { ok: true };
}
