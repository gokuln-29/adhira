"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { HeaderSearch } from "@/components/layout/header-search";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart/cart-context";
import { useDeliveryRules } from "@/lib/delivery/context";
import { formatCutoff } from "@/lib/delivery/rules";

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
  const rules = useDeliveryRules();
  const tEmirates = useTranslations("Emirates");
  const sameDayPlaces = (rules?.zones ?? []).filter((z) => z.enabled && z.same_day).map((z) => tEmirates(z.emirate));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function toggleSearch() {
    setMobileOpen(false);
    setSearchOpen((open) => !open);
  }

  function toggleMobileMenu() {
    setSearchOpen(false);
    setMobileOpen((open) => !open);
  }

  const iconBtn =
    "text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none";

  return (
    <>
      <div className="bg-(--color-ink) px-4 py-2 text-center font-mono-label text-[10px] tracking-[0.16em] text-white/80">
        {rules && sameDayPlaces.length > 0
          ? t("announcement", { places: sameDayPlaces.join(locale === "ar" ? "، " : ", "), cutoff: formatCutoff(rules.sameDayCutoff, locale) })
          : t("announcementNext")}
      </div>
      <header className="sticky top-0 z-20 border-b border-(--color-hairline) bg-(--color-canvas)/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-6 py-4 md:py-5">
          <div className="flex items-center">
            <button
              type="button"
              aria-label={mobileOpen ? t("closeMenu") : t("menu")}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={toggleMobileMenu}
              className={cn(iconBtn, "xl:hidden")}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <nav className="hidden items-center gap-7 xl:flex" aria-label={t("primaryNav")}>
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group relative font-mono-label text-[11px] tracking-[0.14em] text-(--color-ink)"
                >
                  {t(item.key)}
                  <span className="absolute -bottom-1.5 start-0 h-px w-full origin-left scale-x-0 bg-(--color-gold) transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right" />
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/" className="font-logo text-[0.95rem] text-(--color-ink) [--logo-tracking:0.13em] sm:text-[1.15rem] sm:[--logo-tracking:0.2em] md:text-[1.55rem] md:[--logo-tracking:0.24em]">
            Adhira Flowers
          </Link>

          <div className="flex items-center justify-end gap-4 md:gap-5">
            <button
              type="button"
              aria-label={searchOpen ? t("closeSearch") : t("search")}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              onClick={toggleSearch}
              className={iconBtn}
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
            <Link href="/account" aria-label={t("account")} className={cn(iconBtn, "hidden sm:block")}>
              <AccountIcon />
            </Link>
            <Link href="/cart" aria-label={t("cart")} className={cn(iconBtn, "relative")}>
              <CartIcon />
              {count > 0 && (
                <span className="absolute -end-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-primary) px-1 font-mono-label text-[9px] text-white">
                  {count}
                </span>
              )}
            </Link>
            <div className="hidden items-center border-(--color-hairline) font-mono-label text-[11px] ltr:border-l ltr:pl-3 rtl:border-r rtl:pr-3 sm:flex">
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

        {searchOpen && <HeaderSearch onClose={() => setSearchOpen(false)} />}

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label={t("primaryNav")}
          className="flex flex-col border-t border-(--color-hairline) px-6 py-4 xl:hidden"
        >
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="border-b border-(--color-hairline) py-4 font-display text-2xl text-(--color-ink) last:border-0"
            >
              {t(item.key)}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-4 font-mono-label text-[11px]">
            {routing.locales.map((loc) => (
              <Link
                key={loc}
                href={pathname}
                locale={loc}
                aria-current={loc === locale ? "true" : undefined}
                className={
                  loc === locale
                    ? "text-(--color-primary)"
                    : "text-(--color-muted) hover:text-(--color-ink)"
                }
              >
                {loc === "en" ? "EN" : "AR"}
              </Link>
            ))}
          </div>
        </nav>
      )}
      </header>
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 5h13M2.5 9h13M2.5 13h13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4 4l10 10M14 4L4 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
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
