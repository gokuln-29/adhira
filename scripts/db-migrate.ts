// Applies drizzle/*.sql. Run with the schema-owner credentials, NOT the
// least-privilege app user:  DATABASE_MIGRATE_URL=... npm run db:migrate
import "./_env";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_MIGRATE_URL;
  if (!url) throw new Error("DATABASE_MIGRATE_URL is not set");
  const conn = await mysql.createConnection({ uri: url, multipleStatements: false });
  await migrate(drizzle(conn), { migrationsFolder: "./drizzle" });
  await conn.end();
  console.log("migrations applied");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
