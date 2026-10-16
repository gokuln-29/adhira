"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { roleCan, type AdminRole, type Permission } from "@/lib/admin/roles";

const navGroups: {
  heading?: string;
  items: { label: string; href: string; needs?: Permission }[];
}[] = [
  {
    items: [{ label: "Today", href: "/admin" }],
  },
  {
    heading: "Sell",
    items: [
      { label: "Orders", href: "/admin/orders" },
      { label: "Products", href: "/admin/products", needs: "editContent" },
      { label: "Categories", href: "/admin/categories", needs: "editContent" },
      { label: "Offers & Coupons", href: "/admin/offers", needs: "editContent" },
      { label: "Payment Links", href: "/admin/payment-links", needs: "ownerOnly" },
    ],
  },
  {
    heading: "Grow",
    items: [
      { label: "Leads (CRM)", href: "/admin/crm" },
      { label: "Blog", href: "/admin/blog", needs: "editContent" },
    ],
  },
  {
    heading: "Manage",
    items: [
      { label: "Customers", href: "/admin/customers" },
      { label: "Reports", href: "/admin/reports", needs: "editContent" },
      { label: "Redirects", href: "/admin/redirects", needs: "editContent" },
      { label: "Delivery", href: "/admin/delivery", needs: "ownerOnly" },
      { label: "Settings", href: "/admin/settings", needs: "ownerOnly" },
    ],
  },
];

export function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  // Phones: the menu is a drawer opened from a button; from lg up it is the fixed column.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Close the drawer after navigating.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <>
    <button
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="admin-nav"
      onClick={() => setOpen((o) => !o)}
      className="fixed start-2 top-2 z-50 inline-flex size-11 items-center justify-center rounded-[2px] border border-(--color-hairline) bg-(--color-surface) lg:hidden"
    >
      <span aria-hidden="true" className="text-lg leading-none">{open ? "✕" : "☰"}</span>
    </button>
    {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside
      id="admin-nav"
      className={cn(
        "w-56 shrink-0 overflow-y-auto border-e border-(--color-hairline) bg-(--color-canvas) px-4 py-6",
        "max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:z-40 max-lg:w-64 max-lg:pt-16 max-lg:transition-transform max-lg:duration-200 motion-reduce:max-lg:transition-none",
        open ? "max-lg:translate-x-0" : "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
      )}
    >
      <Link href="/admin" className="block px-2 font-logo text-sm">
        Adhira Flowers
      </Link>

      <nav className="mt-8 flex flex-col gap-6">
        {navGroups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.needs || roleCan(role, item.needs)),
          }))
          .filter((group) => group.items.length > 0)
          .map((group, i) => (
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
    </>
  );
}
