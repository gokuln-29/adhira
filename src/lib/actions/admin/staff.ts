"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, type AdminRole } from "@/lib/admin/auth";
import { staffInputSchema } from "@/lib/validators/staff";

type ActionResult = { ok: true } | { ok: false; error: string };

// Uses the service-role client (needed to create an Auth user), which skips
// RLS — so the owner-only rule is enforced here explicitly.
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

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("[addStaffMember] createUser failed", error);
    return { ok: false, error: "Couldn't create that account. The email may already be in use." };
  }

  const { error: insertError } = await supabase.from("admin_users").insert({
    auth_user_id: data.user.id,
    name,
    role,
  });
  if (insertError) {
    console.error("[addStaffMember] admin_users insert failed", insertError);
    // Don't leave an orphaned login behind.
    await supabase.auth.admin.deleteUser(data.user.id);
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

  const supabase = createAdminClient();
  // The DB trigger also refuses to remove the last owner.
  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (error) {
    console.error("[removeStaffMember] delete failed", error);
    return { ok: false, error: "Couldn't remove that staff member." };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}
