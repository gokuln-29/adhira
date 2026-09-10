"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    items: [{ label: "Dashboard", href: "/admin" }],
  },
  {
    heading: "Sell",
    items: [
      { label: "Products", href: "/admin/products" },
      { label: "Orders", href: "/admin/orders" },
      { label: "Offers & Coupons", href: "/admin/offers" },
      { label: "Payment Links", href: "/admin/payment-links" },
    ],
  },
  {
    heading: "Grow",
    items: [
      { label: "CRM", href: "/admin/crm" },
      { label: "Blog", href: "/admin/blog" },
    ],
  },
  {
    heading: "Manage",
    items: [
      { label: "Customers", href: "/admin/customers" },
      { label: "Reports", href: "/admin/reports" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-e border-(--color-hairline) px-4 py-6">
      <Link href="/admin" className="block px-2 font-mono-label text-sm">
        Flowers &amp; Gifts
      </Link>

      <nav className="mt-8 flex flex-col gap-6">
        {navGroups.map((group, i) => (
          <div key={i} className="flex flex-col gap-1">
            {group.heading && (
              <span className="px-2 font-mono-label text-[10px] text-(--color-muted)">
                {group.heading}
              </span>
            )}
            {group.items.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-[2px] px-2 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                    active
                      ? "bg-(--color-primary)/10 text-(--color-primary)"
                      : "text-(--color-ink) hover:bg-(--color-hairline)/40",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
