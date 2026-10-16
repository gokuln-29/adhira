// Creates (or resets the password of) an admin account.
//   ADMIN_EMAIL=you@adhiraflowers.ae ADMIN_NAME="Your Name" ADMIN_ROLE=owner \
//   ADMIN_PASSWORD='...' DATABASE_MIGRATE_URL=... npm run admin:create
// Password comes from the environment so it never lands in shell history via argv.
import "./_env";
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import mysql from "mysql2/promise";

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Admin", ADMIN_ROLE = "owner", DATABASE_MIGRATE_URL } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !DATABASE_MIGRATE_URL) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD and DATABASE_MIGRATE_URL");
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error("Use a password of at least 12 characters");
  if (!["owner", "manager", "staff"].includes(ADMIN_ROLE)) throw new Error("ADMIN_ROLE must be owner, manager or staff");
  const password_hash = await hash(ADMIN_PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const conn = await mysql.createConnection({ uri: DATABASE_MIGRATE_URL, timezone: "Z" });
  await conn.query(
    `INSERT INTO admin_users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), role = VALUES(role),
       failed_logins = 0, locked_until = NULL`,
    [randomUUID(), ADMIN_EMAIL.toLowerCase(), ADMIN_NAME, ADMIN_ROLE, password_hash],
  );
  await conn.end();
  console.log(`Admin ready: ${ADMIN_EMAIL.toLowerCase()} (${ADMIN_ROLE})`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
