import type { InvoiceView } from "@/lib/invoices/data";
import { formatAmount } from "@/lib/pricing";

// Bilingual (English + Arabic) UAE tax invoice. Arabic is required on UAE tax
// invoices; English is added for the customer. Everything shown comes from the
// immutable invoice snapshot + the order's line snapshots.
const L = {
  title: ["TAX INVOICE", "فاتورة ضريبية"],
  invoiceNo: ["Invoice no.", "رقم الفاتورة"],
  date: ["Date of issue", "تاريخ الإصدار"],
  orderNo: ["Order no.", "رقم الطلب"],
  supplier: ["Supplier", "المورّد"],
  customer: ["Customer", "العميل"],
  trn: ["TRN", "الرقم الضريبي"],
  desc: ["Description", "الوصف"],
  qty: ["Qty", "الكمية"],
  unit: ["Unit price", "سعر الوحدة"],
  taxable: ["Taxable amount", "المبلغ الخاضع للضريبة"],
  vatPct: ["VAT %", "نسبة الضريبة"],
  vat: ["VAT", "الضريبة"],
  total: ["Total", "الإجمالي"],
  subtotal: ["Total excl. VAT", "الإجمالي قبل الضريبة"],
  vatTotal: ["Total VAT", "إجمالي ضريبة القيمة المضافة"],
  delivery: ["Delivery", "التوصيل"],
  deposit: ["Refundable deposit (not subject to VAT)", "تأمين قابل للاسترداد (غير خاضع للضريبة)"],
  grand: ["Total paid", "إجمالي المدفوع"],
  payment: ["Payment", "طريقة الدفع"],
  vessel: ["with glass vessel", "مع إناء زجاجي"],
  rental: ["rental, {n} month(s)", "إيجار، {n} شهر"],
  note: ["This is a computer-generated tax invoice. Amounts in UAE dirhams (AED).", "هذه فاتورة ضريبية صادرة إلكترونيًا. المبالغ بالدرهم الإماراتي."],
  trnMissing: ["Supplier TRN not yet registered", "الرقم الضريبي للمورّد غير مسجّل بعد"],
} as const;

const PAYMENT: Record<string, [string, string]> = {
  card: ["Card", "بطاقة"],
  link: ["Payment link", "رابط دفع"],
  manual: ["Bank transfer / other", "تحويل بنكي / أخرى"],
  cod: ["Cash on delivery", "الدفع عند الاستلام"],
};

function Bi({ k, className }: { k: keyof typeof L; className?: string }) {
  return (
    <span className={className}>
      <span>{L[k][0]}</span>
      <span lang="ar" dir="rtl" className="mx-2 inline-block text-[0.95em] opacity-70" style={{ fontFamily: "var(--font-arabic)" }}>
        {L[k][1]}
      </span>
    </span>
  );
}

const dubaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "2-digit", year: "numeric" });

export function InvoiceDocument({ invoice }: { invoice: InvoiceView }) {
  const { seller, buyer } = invoice;
  const addr = buyer.address as { line1?: string; line2?: string; area?: string; landmark?: string };
  const buyerAddress = [addr.line1, addr.line2, addr.area, buyer.emirate].filter(Boolean).join(", ");
  const pay = PAYMENT[invoice.order.payment_method] ?? PAYMENT.card;
  const money = (n: number) => formatAmount(n);

  return (
    <article className="invoice mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-[12px] leading-snug text-black">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="text-lg font-bold">{seller.legal_name ?? "Adhira Flowers"}</p>
          {seller.legal_name_ar && (
            <p lang="ar" dir="rtl" className="text-base font-semibold" style={{ fontFamily: "var(--font-arabic)" }}>
              {seller.legal_name_ar}
            </p>
          )}
          {seller.address && <p className="mt-1 max-w-[80mm]">{seller.address}</p>}
          {seller.address_ar && (
            <p lang="ar" dir="rtl" className="max-w-[80mm]" style={{ fontFamily: "var(--font-arabic)" }}>
              {seller.address_ar}
            </p>
          )}
          <p className="mt-1">
            <Bi k="trn" />: {seller.trn ? <b>{seller.trn}</b> : <b className="text-red-700"><Bi k="trnMissing" /></b>}
          </p>
          {(seller.phone || seller.email) && <p>{[seller.phone, seller.email].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="text-end">
          <p className="text-xl font-bold tracking-wide">{L.title[0]}</p>
          <p lang="ar" dir="rtl" className="text-xl font-bold" style={{ fontFamily: "var(--font-arabic)" }}>
            {L.title[1]}
          </p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 font-bold"><Bi k="customer" /></p>
          <p className="font-semibold">{buyer.company || buyer.name}</p>
          {buyer.company && <p>{buyer.name}</p>}
          {buyer.trn && <p><Bi k="trn" />: {buyer.trn}</p>}
          {buyerAddress && <p>{buyerAddress}</p>}
          <p>{[buyer.phone, buyer.email].filter(Boolean).join(" · ")}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start">
          <dt><Bi k="invoiceNo" /></dt>
          <dd className="font-bold" dir="ltr">{invoice.number}</dd>
          <dt><Bi k="date" /></dt>
          <dd>{dubaiDate(invoice.issued_at)}</dd>
          <dt><Bi k="orderNo" /></dt>
          <dd dir="ltr">{invoice.order.number}</dd>
          <dt><Bi k="payment" /></dt>
          <dd>{pay[0]} <span lang="ar" dir="rtl" style={{ fontFamily: "var(--font-arabic)" }}>{pay[1]}</span></dd>
        </dl>
      </section>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-start">
            <th className="border border-neutral-400 p-1.5 text-start">#</th>
            <th className="border border-neutral-400 p-1.5 text-start"><Bi k="desc" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="qty" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="unit" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="taxable" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="vatPct" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="vat" /></th>
            <th className="border border-neutral-400 p-1.5 text-end"><Bi k="total" /></th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="border border-neutral-300 p-1.5">{i + 1}</td>
              <td className="border border-neutral-300 p-1.5">
                <div>{l.name}</div>
                {l.name_ar && (
                  <div lang="ar" dir="rtl" className="text-start" style={{ fontFamily: "var(--font-arabic)" }}>
                    {l.name_ar}
                  </div>
                )}
                {(l.vessel || l.rental_months) && (
                  <div className="text-[10px] opacity-70">
                    {[l.rental_months ? L.rental[0].replace("{n}", String(l.rental_months)) : "", l.vessel ? L.vessel[0] : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </td>
              <td className="border border-neutral-300 p-1.5 text-end">{l.qty}</td>
              <td className="border border-neutral-300 p-1.5 text-end">{money(l.unit_price)}</td>
              <td className="border border-neutral-300 p-1.5 text-end">{money(l.line_total)}</td>
              <td className="border border-neutral-300 p-1.5 text-end">{l.vat_rate}%</td>
              <td className="border border-neutral-300 p-1.5 text-end">{money(l.vat)}</td>
              <td className="border border-neutral-300 p-1.5 text-end">{money(l.line_total + l.vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="ms-auto mt-4 w-[95mm] border-collapse">
        <tbody>
          <tr><td className="p-1"><Bi k="subtotal" /></td><td className="p-1 text-end">{money(invoice.subtotal)}</td></tr>
          <tr><td className="p-1"><Bi k="vatTotal" /></td><td className="p-1 text-end">{money(invoice.vat)}</td></tr>
          {invoice.delivery_fee > 0 && (
            <tr><td className="p-1"><Bi k="delivery" /></td><td className="p-1 text-end">{money(invoice.delivery_fee)}</td></tr>
          )}
          {invoice.deposit_total > 0 && (
            <tr><td className="p-1"><Bi k="deposit" /></td><td className="p-1 text-end">{money(invoice.deposit_total)}</td></tr>
          )}
          <tr className="border-t-2 border-black text-sm font-bold">
            <td className="p-1"><Bi k="grand" /> ({invoice.currency})</td>
            <td className="p-1 text-end">{money(invoice.total)}</td>
          </tr>
        </tbody>
      </table>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] opacity-80">
        <p>{L.note[0]}</p>
        <p lang="ar" dir="rtl" style={{ fontFamily: "var(--font-arabic)" }}>{L.note[1]}</p>
      </footer>
    </article>
  );
}
