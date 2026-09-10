// Canonical values — match the `orders.emirate` check constraint and the
// `Emirates` translation namespace keys exactly (English keys; the displayed
// label is localized, the stored value never is).
export const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
] as const;
