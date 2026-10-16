import "server-only";
import { randomUUID } from "node:crypto";

export const newId = (): string => randomUUID();

/** MySQL duplicate-key error (ER_DUP_ENTRY = 1062), through Drizzle's wrapper too. */
export function isDuplicateKey(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const rec = e as { errno?: number; code?: string; cause?: unknown };
    if (rec.errno === 1062 || rec.code === "ER_DUP_ENTRY") return true;
    e = rec.cause;
  }
  return false;
}

/** Escape LIKE wildcards in user input. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Friendly, non-leaky message for a failed admin write; the detail goes to the server log. */
export function dbErrorMessage(err: unknown, what: string): string {
  if (isDuplicateKey(err)) return `Another ${what} already uses that slug, code or name.`;
  console.error(`[db] ${what} write failed`, err);
  return `Couldn't save the ${what}. Please try again.`;
}
