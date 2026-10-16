// Invoice numbering: AF/<financial year>/<sequence>, e.g. AF/2026-27/001.
// The financial year runs 1 April -> 31 March, evaluated in Dubai time, and the
// sequence restarts at 001 each year (3 digits minimum, grows past 999).
// Pure functions, no server imports.
export const INVOICE_PREFIX = "AF";
export const FY_START_MONTH = 4; // April; change here if the accountant decides otherwise

/** Calendar parts of an instant in Asia/Dubai. */
function dubaiParts(at: Date): { year: number; month: number } {
  const [year, month] = at.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }).split("-").map(Number);
  return { year, month };
}

export function financialYear(at: Date = new Date()): string {
  const { year, month } = dubaiParts(at);
  const start = month >= FY_START_MONTH ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(fy: string, seq: number): string {
  return `${INVOICE_PREFIX}/${fy}/${String(seq).padStart(3, "0")}`;
}
