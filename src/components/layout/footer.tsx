import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getStoreSettings } from "@/lib/data/settings";

// Only payment methods that actually work at checkout today.
const paymentMarks = ["Visa", "Mastercard", "Apple Pay"];

export async function Footer() {
  const [t, settings] = await Promise.all([getTranslations("Footer"), getStoreSettings()]);

  const columns = [
    {
      heading: t("shopHeading"),
      links: [
        { label: t("flowerArrangements"), href: "/shop/flower-arrangements" },
        { label: t("indoorPlants"), href: "/shop/indoor-plants" },
        { label: t("corporateGifting"), href: "/shop?tag=gifts" },
        { label: t("offers"), href: "/offers" },
      ],
    },
    {
      heading: t("corporateHeading"),
      links: [
        { label: t("recurringService"), href: "/corporate" },
        { label: t("indoorSetups"), href: "/setups" },
        { label: t("requestQuote"), href: "/corporate#quote" },
      ],
    },
    {
      heading: t("companyHeading"),
      links: [
        { label: t("about"), href: "/about" },
        { label: t("contact"), href: "/contact" },
        { label: t("delivery"), href: "/delivery" },
        { label: t("returns"), href: "/returns" },
        { label: t("privacy"), href: "/privacy" },
        { label: t("terms"), href: "/terms" },
      ],
    },
    {
      heading: t("resourcesHeading"),
      links: [
        { label: t("blog"), href: "/blog" },
        { label: t("account"), href: "/account" },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-(--color-ink) text-white">
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-10">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-4">
            <span className="font-logo text-2xl">Adhira flowers</span>
            <span className="gold-rule" />
            <p className="max-w-xs text-sm leading-relaxed text-white/65">{t("tagline")}</p>
            {(settings.contact_phone || settings.contact_email) && (
              <ul className="flex flex-col gap-1.5 text-sm text-white/85">
                {settings.contact_phone && (
                  <li>
                    <a href={`tel:${settings.contact_phone.replace(/[^+\d]/g, "")}`} className="transition-colors hover:text-(--color-mint)">
                      {settings.contact_phone}
                    </a>
                  </li>
                )}
                {settings.contact_email && (
                  <li>
                    <a href={`mailto:${settings.contact_email}`} className="transition-colors hover:text-(--color-mint)">
                      {settings.contact_email}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            {columns.map((column) => (
              <div key={column.heading} className="flex flex-col gap-4">
                <p className="font-mono-label text-[11px] tracking-[0.18em] text-(--color-gold)">
                  {column.heading}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-block py-1 text-sm text-white/75 transition-colors hover:text-white motion-reduce:transition-none"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-5 border-t border-white/15 pt-8 md:flex-row md:items-center">
          <p className="font-mono-label text-[10px] tracking-[0.14em] text-white/55">
            {settings.trn && <>{t("trn")} {settings.trn} &middot; </>}&copy; {new Date().getFullYear()} Adhira flowers &middot; {t("rights")}
          </p>
          <div className="flex flex-wrap gap-2">
            {paymentMarks.map((mark) => (
              <span
                key={mark}
                className="rounded-[2px] border border-white/20 px-2.5 py-1 font-mono-label text-[10px] tracking-[0.1em] text-white/60"
              >
                {mark}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
