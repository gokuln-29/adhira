import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { admin_users } from "@/lib/db/schema";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "staff";
  totp_enabled: boolean;
  created_at: string;
}

export async function getAllStaff(): Promise<StaffRow[]> {
  return db
    .select({
      id: admin_users.id,
      name: admin_users.name,
      email: admin_users.email,
      role: admin_users.role,
      totp_enabled: admin_users.totp_enabled,
      created_at: admin_users.created_at,
    })
    .from(admin_users)
    .orderBy(asc(admin_users.created_at));
}
