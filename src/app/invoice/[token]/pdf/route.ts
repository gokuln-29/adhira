import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceByToken } from "@/lib/invoices/data";
import { isPdfConfigured, renderInvoicePdf } from "@/lib/invoices/pdf";
import { withinRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  if (!isPdfConfigured()) {
    // Fall back to the printable page rather than failing.
    return NextResponse.redirect(new URL(`/invoice/${token}`, _req.url));
  }
  if (!(await withinRateLimit("invoice-pdf", 10, 600))) {
    return new NextResponse("Too many requests", { status: 429 });
  }
  try {
    const pdf = await renderInvoicePdf(token);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number.replaceAll("/", "-")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[invoice pdf]", err);
    return new NextResponse("Couldn't generate the PDF. Use the printable page instead.", { status: 502 });
  }
}
