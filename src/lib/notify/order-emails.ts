import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, order_items, orders, store_settings } from "@/lib/db/schema";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { formatAED } from "@/lib/pricing";
import { esc, isEmailConfigured, sendEmail } from "@/lib/notify/email";

const TEXT = {
  en: {
    dir: "ltr",
    subject: (n: string) => `Your order ${n} is confirmed`,
    heading: "Thank you for your order",
    intro: "We've received your order and will confirm delivery details shortly.",
    order: "Order",
    deliveryOn: "Delivery date",
    asap: "As soon as possible",
    items: "Items",
    subtotal: "Subtotal",
    vat: "VAT",
    deposit: "Refundable deposit",
    total: "Total",
    rental: (m: number) => `Rental, ${m} month${m === 1 ? "" : "s"}`,
    vessel: "With glass vessel",
    view: "View your order",
    help: "Questions? Just reply to this email.",
  },
  ar: {
    dir: "rtl",
    subject: (n: string) => `تم تأكيد طلبك ${n}`,
    heading: "شكرًا لطلبك",
    intro: "استلمنا طلبك وسنؤكد تفاصيل التوصيل قريبًا.",
    order: "الطلب",
    deliveryOn: "تاريخ التوصيل",
    asap: "في أقرب وقت ممكن",
    items: "المنتجات",
    subtotal: "المجموع الفرعي",
    vat: "ضريبة القيمة المضافة",
    deposit: "تأمين قابل للاسترداد",
    total: "الإجمالي",
    rental: (m: number) => `إيجار، ${m} أشهر`,
    vessel: "مع إناء زجاجي",
    view: "عرض طلبك",
    help: "لديك أسئلة؟ يكفي أن ترد على هذه الرسالة.",
  },
} as const;

interface OrderRow {
  number: string;
  public_token: string;
  channel: string;
  emirate: string | null;
  delivery_date: string | null;
  address: { line1?: string; line2?: string; area?: string; landmark?: string } | null;
  notes: string | null;
  subtotal: number;
  vat: number;
  deposit_total: number;
  total: number;
  customers: { name: string; email: string; phone: string | null; company: string | null } | null;
  order_items: {
    name: string;
    qty: number;
    line_total: number;
    vessel: boolean;
    rental_months: number | null;
  }[];
}

async function loadOrder(number: string): Promise<OrderRow | null> {
  try {
    const rows = await db
      .select({
        id: orders.id,
        number: orders.number,
        public_token: orders.public_token,
        channel: orders.channel,
        emirate: orders.emirate,
        delivery_date: orders.delivery_date,
        address: orders.address,
        notes: orders.notes,
        subtotal: orders.subtotal,
        vat: orders.vat,
        deposit_total: orders.deposit_total,
        total: orders.total,
        c_name: customers.name,
        c_email: customers.email,
        c_phone: customers.phone,
        c_company: customers.company,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customer_id, customers.id))
      .where(eq(orders.number, number))
      .limit(1);
    const o = rows[0];
    if (!o) return null;
    const items = await db
      .select({
        name: order_items.name,
        qty: order_items.qty,
        line_total: order_items.line_total,
        vessel: order_items.vessel,
        rental_months: order_items.rental_months,
      })
      .from(order_items)
      .where(eq(order_items.order_id, o.id));
    return {
      ...o,
      address: o.address as OrderRow["address"],
      customers: o.c_name == null ? null : { name: o.c_name, email: o.c_email ?? "", phone: o.c_phone, company: o.c_company },
      order_items: items,
    };
  } catch (err) {
    console.error("[order-emails] load failed", err);
    return null;
  }
}

async function contactEmail(): Promise<string | null> {
  const rows = await db.select({ e: store_settings.contact_email }).from(store_settings).limit(1);
  return rows[0]?.e ?? null;
}

const row = (label: string, value: string, strong = false) =>
  `<tr><td style="padding:4px 0;color:#6b756f">${esc(label)}</td><td style="padding:4px 0;text-align:end;${strong ? "font-weight:700" : ""}">${esc(value)}</td></tr>`;

function customerHtml(order: OrderRow, locale: "en" | "ar"): string {
  const t = TEXT[locale];
  const items = order.order_items
    .map((i) => {
      const notes = [i.rental_months ? t.rental(i.rental_months) : "", i.vessel ? t.vessel : ""]
        .filter(Boolean)
        .join(" · ");
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #e9edea">${esc(i.name)} × ${i.qty}${
        notes ? `<br><span style="color:#6b756f;font-size:12px">${esc(notes)}</span>` : ""
      }</td><td style="padding:8px 0;border-bottom:1px solid #e9edea;text-align:end">${esc(formatAED(Number(i.line_total)))}</td></tr>`;
    })
    .join("");
  const link = `${SITE_URL}/${locale}/order-confirmation/${order.public_token}`;
  return `<!doctype html><html dir="${t.dir}"><body style="margin:0;background:#fafbfa;font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:12px;letter-spacing:2px;color:#0e7c5a;margin:0 0 12px">${esc(SITE_NAME.toUpperCase())}</p>
<h1 style="font-size:24px;margin:0 0 8px">${esc(t.heading)}</h1>
<p style="color:#6b756f;margin:0 0 24px">${esc(t.intro)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px">
${row(t.order, order.number, true)}
${row(t.deliveryOn, order.delivery_date ?? t.asap)}
</table>
<p style="font-weight:700;margin:20px 0 4px">${esc(t.items)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${items}</table>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
${row(t.subtotal, formatAED(Number(order.subtotal)))}
${row(t.vat, formatAED(Number(order.vat)))}
${Number(order.deposit_total) > 0 ? row(t.deposit, formatAED(Number(order.deposit_total))) : ""}
${row(t.total, formatAED(Number(order.total)), true)}
</table>
<p style="margin:28px 0"><a href="${esc(link)}" style="background:#0e7c5a;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px">${esc(t.view)}</a></p>
<p style="color:#6b756f;font-size:13px">${esc(t.help)}</p>
</div></body></html>`;
}

function teamHtml(order: OrderRow): string {
  const a = order.address ?? {};
  const address = [a.line1, a.line2, a.area, order.emirate].filter(Boolean).join(", ");
  const lines = order.order_items
    .map(
      (i) =>
        `<li>${esc(i.name)} × ${i.qty}${i.rental_months ? ` (rental, ${i.rental_months} mo)` : ""}${i.vessel ? " (glass vessel)" : ""}</li>`,
    )
    .join("");
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<h2 style="margin:0 0 8px">New order ${esc(order.number)}</h2>
<p style="margin:0 0 12px"><b>${esc(formatAED(Number(order.total)))}</b> · ${esc(order.channel)} · deliver ${esc(order.delivery_date ?? "ASAP")}</p>
<p style="margin:0 0 12px">${esc(order.customers?.name)}${order.customers?.company ? ` (${esc(order.customers.company)})` : ""}<br>
${esc(order.customers?.phone)} · ${esc(order.customers?.email)}<br>${esc(address)}</p>
<ul>${lines}</ul>
${order.notes ? `<p>${esc(order.notes)}</p>` : ""}
<p><a href="${esc(`${SITE_URL}/admin/orders/${order.number}`)}">Open in admin</a></p>
</body></html>`;
}

export function teamEmailAddress(contactEmail: string | null): string | null {
  return process.env.ORDER_NOTIFY_EMAIL || contactEmail || null;
}

// Sends the customer's confirmation and the team's "new order" alert. Safe to
// call without email configured; never throws.
export async function sendOrderNotifications(number: string, locale: "en" | "ar"): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const order = await loadOrder(number);
    if (!order) return;

    if (order.customers?.email) {
      await sendEmail({
        to: order.customers.email,
        subject: TEXT[locale].subject(order.number),
        html: customerHtml(order, locale),
      });
    }

    const team = teamEmailAddress(await contactEmail());
    if (team) {
      await sendEmail({
        to: team,
        subject: `New order ${order.number}`,
        html: teamHtml(order),
        replyTo: order.customers?.email,
      });
    }
  } catch (err) {
    console.error("[order-emails] failed", err);
  }
}

export async function sendLeadNotification(lead: {
  contact: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  requirement: string | null;
  message: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const team = teamEmailAddress(await contactEmail());
    if (!team) return;
    await sendEmail({
      to: team,
      subject: `New enquiry from ${lead.contact}`,
      replyTo: lead.email ?? undefined,
      html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<h2 style="margin:0 0 8px">New enquiry</h2>
<p>${esc(lead.contact)}${lead.company ? ` (${esc(lead.company)})` : ""}<br>${esc(lead.email)} · ${esc(lead.phone)}</p>
${lead.requirement ? `<p><b>${esc(lead.requirement)}</b></p>` : ""}${lead.message ? `<p>${esc(lead.message)}</p>` : ""}
<p><a href="${esc(`${SITE_URL}/admin/crm`)}">Open leads in admin</a></p>
</body></html>`,
    });
  } catch (err) {
    console.error("[lead-email] failed", err);
  }
}
