import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { getInvoiceByToken } from "@/lib/invoices/data";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const [{ token }, { print }] = await Promise.all([params, searchParams]);
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  return (
    <main className="py-6 print:py-0">
      {print !== "1" && (
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
          <span className="font-mono text-xs">{invoice.number}</span>
          <span className="flex gap-3 text-sm">
            <a className="underline" href={`/invoice/${token}/pdf`}>
              Download PDF · تنزيل PDF
            </a>
          </span>
        </div>
      )}
      <InvoiceDocument invoice={invoice} />
    </main>
  );
}
