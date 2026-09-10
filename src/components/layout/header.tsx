"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { MonoLabel } from "@/components/ui/mono-label";
import { useCart } from "@/lib/cart/cart-context";

const navItems = [
  { key: "shop", href: "/shop" },
  { key: "corporate", href: "/corporate" },
  { key: "plants", href: "/shop/indoor-plants" },
  { key: "gifts", href: "/shop?tag=gifts" },
  { key: "offers", href: "/offers" },
  { key: "resources", href: "/blog" },
] as const;

export function Header() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-(--color-hairline) bg-(--color-surface)/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="font-mono-label text-sm text-(--color-ink)">
          Flowers &amp; Gifts
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label={t("primaryNav")}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="font-mono-label text-[11px] text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={t("search")}
            className="text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none"
          >
            <SearchIcon />
          </button>
          <Link
            href="/account"
            aria-label={t("account")}
            className="text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none"
          >
            <AccountIcon />
          </Link>
          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none"
          >
            <CartIcon />
            {count > 0 && (
              <MonoLabel
                as="span"
                muted={false}
                className="absolute -end-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-primary) px-1 text-[9px] text-white"
              >
                {count}
              </MonoLabel>
            )}
          </Link>
          <div className="flex items-center border-(--color-hairline) font-mono-label text-[11px] ltr:border-l ltr:pl-2 rtl:border-r rtl:pr-2">
            {routing.locales.map((loc) => (
              <Link
                key={loc}
                href={pathname}
                locale={loc}
                aria-current={loc === locale ? "true" : undefined}
                className={
                  "flex min-h-6 min-w-6 items-center justify-center px-1 " +
                  (loc === locale
                    ? "text-(--color-primary)"
                    : "text-(--color-muted) hover:text-(--color-ink)")
                }
              >
                {loc === "en" ? "EN" : "AR"}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 16L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 16c1-3.5 4-5 6.5-5s5.5 1.5 6.5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2 4h2l1.6 8.6a1.5 1.5 0 0 0 1.5 1.2h6.1a1.5 1.5 0 0 0 1.5-1.2L16 6H5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="16" r="1" fill="currentColor" />
      <circle cx="13.5" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
