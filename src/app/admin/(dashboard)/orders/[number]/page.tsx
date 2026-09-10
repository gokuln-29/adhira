import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { OrderStatusSelect } from "@/components/admin/orders/order-status-select";
import { getOrderByNumberAdmin } from "@/lib/data/admin/orders";
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
  const order = await getOrderByNumberAdmin(number);
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
              <div key={i} className="flex justify-between py-3 text-sm">
                <span>
                  {item.name} <span className="text-(--color-muted)">×{item.qty}</span>
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
