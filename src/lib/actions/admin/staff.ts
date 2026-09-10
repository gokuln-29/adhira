"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

// Uses the service-role client (needed to create an Auth user), so this
// re-checks admin status itself rather than relying only on the layout gate.
export async function addStaffMember(input: {
  email: string;
  password: string;
  name: string;
  role: "owner" | "admin" | "staff";
}): Promise<ActionResult> {
  const requester = await getCurrentAdmin();
  if (!requester) return { ok: false, error: "Not authorized." };

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
  });
  if (error) return { ok: false, error: error.message };

  const { error: insertError } = await supabase.from("admin_users").insert({
    auth_user_id: data.user.id,
    name: input.name.trim(),
    role: input.role,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeStaffMember(id: string): Promise<ActionResult> {
  const requester = await getCurrentAdmin();
  if (!requester) return { ok: false, error: "Not authorized." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}
