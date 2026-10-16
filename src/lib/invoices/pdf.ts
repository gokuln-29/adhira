import "server-only";
import puppeteer from "puppeteer-core";

// Renders the invoice page with headless Chrome, which handles Arabic shaping and
// bidirectional text correctly (most pure-JS PDF libraries do not). Chrome is an
// optional runtime dependency: set CHROME_PATH (deploy/scripts/provision.sh installs
// it). Without it the invoice page still works and emails fall back to a link.
export class PdfUnavailableError extends Error {}

let queue: Promise<unknown> = Promise.resolve();

export function isPdfConfigured(): boolean {
  return Boolean(process.env.CHROME_PATH);
}

// One render at a time: Chrome costs ~200 MB, and invoices are low volume.
export function renderInvoicePdf(token: string): Promise<Buffer> {
  const job = queue.then(() => render(token));
  queue = job.catch(() => undefined);
  return job;
}

async function render(token: string): Promise<Buffer> {
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) throw new PdfUnavailableError("CHROME_PATH is not set");
  const base = process.env.INTERNAL_URL || `http://127.0.0.1:${process.env.PORT ?? 3000}`;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    timeout: 20_000,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/invoice/${token}?print=1`, { waitUntil: "networkidle0", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
