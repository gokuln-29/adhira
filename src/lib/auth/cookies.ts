import "server-only";

const prod = process.env.NODE_ENV === "production";

// `__Host-` cookies must be Secure with Path=/, which plain-http localhost
// can't satisfy, so the prefix applies in production only.
export const ADMIN_COOKIE = prod ? "__Host-adhira_admin" : "adhira_admin";
export const CUSTOMER_COOKIE = prod ? "__Host-adhira_session" : "adhira_session";

export const cookieOptions = (maxAgeSeconds: number, sameSite: "strict" | "lax" = "lax") => ({
  httpOnly: true,
  secure: prod,
  sameSite,
  path: "/",
  maxAge: maxAgeSeconds,
});
