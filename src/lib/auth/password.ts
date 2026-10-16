import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2), OWASP-recommended minimum parameters.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// Verified against when the email is unknown, so response time doesn't reveal
// which staff emails exist.
let dummy: Promise<string> | undefined;
export function burnPasswordCheck(password: string): Promise<boolean> {
  dummy ??= hashPassword("not-a-real-password");
  return dummy.then((h) => verifyPassword(h, password));
}

export const PASSWORD_MIN_LENGTH = 12;
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Use letters and numbers.";
  return null;
}
