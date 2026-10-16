// Shared cleanup for the verify:* scripts. Invoices are immutable and an invoiced
// order can't be deleted, so tests use the schema-owner escape hatch
// (@allow_invoice_delete) in their own session and put the FY counter back.
import type { Pool } from "mysql2/promise";

export async function counterSnapshot(pool: Pool, fy: string): Promise<number | null> {
  const [rows] = await pool.query("SELECT last_seq FROM invoice_counters WHERE fy = ?", [fy]);
  return (rows as { last_seq: number }[])[0]?.last_seq ?? null;
}

export async function cleanupVerifyData(pool: Pool, fy: string, counterBefore: number | null): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query("SET @allow_invoice_delete = 1");
    const mine = "SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test')";
    await conn.query(`DELETE FROM invoices WHERE order_id IN (${mine})`);
    await conn.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test')");
    await conn.query("DELETE FROM customers WHERE email LIKE '%@verify.test'");
    if (counterBefore === null) await conn.query("DELETE FROM invoice_counters WHERE fy = ?", [fy]);
    else await conn.query("UPDATE invoice_counters SET last_seq = ? WHERE fy = ?", [counterBefore, fy]);
  } finally {
    conn.release();
  }
}
