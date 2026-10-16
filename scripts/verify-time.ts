// Regression test for UTC handling in timestamp columns. Expiry checks (sessions,
// sign-in codes, reset links) once shifted by the server's timezone offset.
// Run under several zones:  npm run verify:time
import "./_env";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

if (!process.env.VERIFY_TIME_CHILD) {
  for (const tz of ["UTC", "Asia/Dubai", "Asia/Kolkata", "America/Los_Angeles"]) {
    const out = execFileSync("npx", ["tsx", "--conditions=react-server", __filename], {
      env: { ...process.env, TZ: tz, VERIFY_TIME_CHILD: "1" },
    }).toString();
    process.stdout.write(out.replace(/^/gm, `[${tz}] `));
  }
} else {
  (async () => {
    const { toMysqlDatetime } = await import("../src/lib/db/schema");
    const { db, pool } = await import("../src/lib/db");
    const { otp_codes } = await import("../src/lib/db/schema");
    const { and, eq, gt } = await import("drizzle-orm");

    // pure
    assert.equal(toMysqlDatetime("2026-10-16T08:00:00.000Z"), "2026-10-16 08:00:00.000");
    assert.equal(toMysqlDatetime(new Date("2026-10-16T08:00:00Z")), "2026-10-16 08:00:00.000");
    assert.equal(toMysqlDatetime("2026-10-16 08:00:00.000"), "2026-10-16 08:00:00.000"); // idempotent
    assert.equal(toMysqlDatetime(toMysqlDatetime(new Date("2026-10-16T08:00:00Z"))), "2026-10-16 08:00:00.000");

    // database round trip through the same code path the auth code uses
    const email = `time-${process.pid}@verify.test`;
    const row = (id: string, offsetMs: number) => ({
      id,
      email,
      code_hash: "x".repeat(64),
      expires_at: new Date(Date.now() + offsetMs).toISOString(),
    });
    try {
      await db.insert(otp_codes).values([
        row(`00000000-0000-4000-8000-${String(process.pid).padStart(12, "0")}`, -60_000), // expired 1 min ago
        row(`00000000-0000-4000-9000-${String(process.pid).padStart(12, "0")}`, +60_000), // valid for 1 more min
      ]);
      const live = await db
        .select({ id: otp_codes.id })
        .from(otp_codes)
        .where(and(eq(otp_codes.email, email), gt(otp_codes.expires_at, toMysqlDatetime(new Date()))));
      assert.equal(live.length, 1, `expected exactly the unexpired row, got ${live.length}`);
      assert(live[0].id.includes("-9000-"));
      const [stored] = await db.select().from(otp_codes).where(eq(otp_codes.id, live[0].id));
      assert(Math.abs(new Date(stored.expires_at).getTime() - (Date.now() + 60_000)) < 5_000, "stored value round-trips to the same instant");
      console.log("PASS UTC handling: expired row excluded, valid row included, round trip exact");
    } finally {
      await pool.query("DELETE FROM otp_codes WHERE email = ?", [email]);
      await pool.end();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
