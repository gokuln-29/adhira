import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { OrderStatusSelect } from "@/components/admin/orders/order-status-select";
import { getOrderByNumberAdmin } from "@/lib/data/admin/orders";
import { PaymentPanel } from "@/components/admin/orders/payment-panel";
import { DepositPanel } from "@/components/admin/orders/deposit-panel";
import { getCurrentAdmin, can } from "@/lib/admin/auth";
import { formatAED } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/actions/admin/orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  return { title: number };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const [order, admin] = await Promise.all([getOrderByNumberAdmin(number), getCurrentAdmin()]);
  if (!order) notFound();

  const address = order.address as {
    line1?: string;
    line2?: string;
    area?: string;
    landmark?: string;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{order.number}</h1>
        <div className="w-56">
          <OrderStatusSelect number={order.number} status={order.status as OrderStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <MonoLabel muted={false} className="mb-4">
            Items
          </MonoLabel>
          <div className="flex flex-col divide-y divide-(--color-hairline)">
            {order.order_items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4 py-3 text-sm">
                <span>
                  {item.name} <span className="text-(--color-muted)">×{item.qty}</span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    {item.rental_months && (
                      <span className="border border-(--color-hairline) px-2 py-0.5 font-mono-label text-[10px]">
                        RENTAL · {item.rental_months} MO
                      </span>
                    )}
                    {item.vessel && (
                      <span className="border border-(--color-hairline) px-2 py-0.5 font-mono-label text-[10px]">
                        GLASS VESSEL{item.vessel_fee > 0 ? ` +${formatAED(item.vessel_fee)}` : ""}
                      </span>
                    )}
                    {item.deposit > 0 && (
                      <span className="border border-(--color-hairline) px-2 py-0.5 font-mono-label text-[10px]">
                        DEPOSIT {formatAED(item.deposit)}
                      </span>
                    )}
                  </span>
                </span>
                <MonoLabel muted={false}>{formatAED(item.line_total)}</MonoLabel>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-(--color-hairline) pt-4 font-mono-label text-xs">
            <div className="flex justify-between">
              <span className="text-(--color-muted)">Subtotal</span>
              <span>{formatAED(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--color-muted)">VAT</span>
              <span>{formatAED(order.vat)}</span>
            </div>
            {order.deposit_total > 0 && (
              <div className="flex justify-between">
                <span className="text-(--color-muted)">Refundable deposit</span>
                <span>{formatAED(order.deposit_total)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-(--color-muted)">Delivery</span>
              <span>{formatAED(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm">
              <span>Total</span>
              <span>{formatAED(order.total)}</span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <PaymentPanel
            number={order.number}
            method={order.payment_method}
            status={order.payment_status}
            orderStatus={order.status}
            canMarkPaid={can(admin, "ownerOnly")}
          />
          <Card className="p-6">
            <MonoLabel muted={false} className="mb-3">
              Tax invoice
            </MonoLabel>
            {order.invoice_number ? (
              <p className="flex flex-col gap-1 text-sm">
                <b dir="ltr">{order.invoice_number}</b>
                <span className="flex gap-4 text-xs">
                  <a className="underline underline-offset-4" href={`/invoice/${order.public_token}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                  <a className="underline underline-offset-4" href={`/invoice/${order.public_token}/pdf`}>
                    Download PDF
                  </a>
                </span>
              </p>
            ) : (
              <p className="text-xs text-(--color-muted)">Issued automatically when the payment is recorded.</p>
            )}
          </Card>
          {order.deposit_total > 0 && order.deposit_status !== "none" && (
            <DepositPanel
              number={order.number}
              total={order.deposit_total}
              status={order.deposit_status}
              canRefund={can(admin, "editContent")}
            />
          )}
          <Card className="p-6">
            <MonoLabel muted={false} className="mb-3">
              History
            </MonoLabel>
            <ul className="flex flex-col gap-2 text-xs">
              {order.history.map((h, i) => (
                <li key={i} className="flex flex-col">
                  <span>
                    {h.kind}: {h.from_value ?? "—"} → <b>{h.to_value}</b>
                  </span>
                  <span className="text-(--color-muted)">
                    {h.actor} · {new Date(h.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <MonoLabel muted={false} className="mb-3">
              Customer
            </MonoLabel>
            <p className="text-sm">{order.customers?.name}</p>
            <p className="text-sm text-(--color-muted)">{order.customers?.email}</p>
            <MonoLabel className="mt-2 text-[10px]">
              {order.channel.toUpperCase()}
            </MonoLabel>
          </Card>

          <Card className="p-6">
            <MonoLabel muted={false} className="mb-3">
              Delivery
            </MonoLabel>
            <p className="text-sm">{address.line1}</p>
            {address.line2 && <p className="text-sm">{address.line2}</p>}
            {address.area && <p className="text-sm text-(--color-muted)">{address.area}</p>}
            <p className="text-sm text-(--color-muted)">{order.emirate}</p>
            {order.delivery_date && (
              <MonoLabel className="mt-2 text-[10px]">
                {new Date(order.delivery_date).toLocaleDateString("en-AE")}
              </MonoLabel>
            )}
            {order.notes && <p className="mt-3 text-sm text-(--color-muted)">{order.notes}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
