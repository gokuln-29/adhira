import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { getStoreSettings } from "@/lib/data/settings";

// Only payment methods that actually work at checkout today.
const paymentMarks = ["Cash on delivery", "Visa", "Mastercard"];

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
    <footer className="border-t border-(--color-hairline)">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-5">
        <div className="flex flex-col gap-3 md:col-span-1">
          <span className="font-mono-label text-sm text-(--color-ink)">
            Flowers N Plants
          </span>
          <p className="max-w-xs text-sm text-(--color-muted)">{t("tagline")}</p>
          {(settings.contact_phone || settings.contact_email) && (
            <ul className="flex flex-col gap-1 text-sm">
              {settings.contact_phone && (
                <li>
                  <a href={`tel:${settings.contact_phone.replace(/[^+\d]/g, "")}`} className="hover:text-(--color-primary)">
                    {settings.contact_phone}
                  </a>
                </li>
              )}
              {settings.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`} className="hover:text-(--color-primary)">
                    {settings.contact_email}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        {columns.map((column) => (
          <div key={column.heading} className="flex flex-col gap-3">
            <MonoLabel as="p">{column.heading}</MonoLabel>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-(--color-ink) transition-colors hover:text-(--color-primary) motion-reduce:transition-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-(--color-hairline) px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <MonoLabel>
            {settings.trn && <>{t("trn")} {settings.trn} &middot; </>}&copy; {new Date().getFullYear()} Flowers N Plants &middot; {t("rights")}
          </MonoLabel>
          <div className="flex gap-3">
            {paymentMarks.map((mark) => (
              <span
                key={mark}
                className="rounded-[2px] border border-(--color-hairline) px-2 py-1 font-mono-label text-[10px] text-(--color-muted)"
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
