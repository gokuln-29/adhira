import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/lib/db/schema";

// One pool per server process (survives Next dev HMR via globalThis).
// DATABASE_URL points at 127.0.0.1 on the VPS; the app user holds only
// SELECT/INSERT/UPDATE/DELETE on this schema (see docs/DEPLOYMENT.md).
const globalForDb = globalThis as unknown as { __mysqlPool?: mysql.Pool };

function createPool(): mysql.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return mysql.createPool({
    uri: url,
    // All DATETIME columns are UTC; never let the driver apply a local offset.
    timezone: "Z",
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    charset: "utf8mb4",
    // JSON/DECIMAL parse behaviour is handled in the schema column types.
    dateStrings: true,
    supportBigNumbers: true,
    namedPlaceholders: false,
  });
}

export const pool: mysql.Pool = (globalForDb.__mysqlPool ??= createPool());
export const db = drizzle(pool, { schema, mode: "default" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
