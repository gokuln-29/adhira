import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { customer_sessions, customers, toMysqlDatetime } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { CUSTOMER_COOKIE, cookieOptions } from "@/lib/auth/cookies";

const SESSION_SECONDS = 30 * 24 * 3600;

export async function createCustomerSession(customerId: string): Promise<void> {
  const token = randomToken();
  await db.insert(customer_sessions).values({
    id: newId(),
    customer_id: customerId,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
  });
  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOptions(SESSION_SECONDS));
}

export interface CustomerSession {
  id: string;
  email: string;
}

export const readCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: customers.id, email: customers.email })
    .from(customer_sessions)
    .innerJoin(customers, eq(customer_sessions.customer_id, customers.id))
    .where(
      and(
        eq(customer_sessions.token_hash, sha256(token)),
        gt(customer_sessions.expires_at, toMysqlDatetime(new Date())),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
});

export async function destroyCustomerSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token) await db.delete(customer_sessions).where(eq(customer_sessions.token_hash, sha256(token)));
  jar.delete(CUSTOMER_COOKIE);
}
