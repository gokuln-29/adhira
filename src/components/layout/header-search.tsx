"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getEffectivePrice, formatAED } from "@/lib/pricing";

interface RawProduct {
  slug: string;
  name: string;
  base_price: number;
  discount_type: "percent" | "flat" | null;
  discount_value: number | null;
  sale_start: string | null;
  sale_end: string | null;
  vat_rate: number;
  product_images: { url: string; is_primary: boolean }[];
}

interface Suggestion {
  slug: string;
  name: string;
  image: string | null;
  price: ReturnType<typeof getEffectivePrice>;
}

export function HeaderSearch({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) return;

    const loadingHandle = setTimeout(() => setLoading(true), 0);
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
      const { data } = await supabase
        .from("products")
        .select(
          "slug, name, base_price, discount_type, discount_value, sale_start, sale_end, vat_rate, product_images(url, is_primary)",
        )
        .eq("status", "active")
        .or(`name.ilike.%${escaped}%,short_description.ilike.%${escaped}%`)
        .limit(5);

      const rows = (data ?? []) as unknown as RawProduct[];
      setSuggestions(
        rows.map((p) => {
          const primary = p.product_images.find((img) => img.is_primary) ?? p.product_images[0];
          return {
            slug: p.slug,
            name: p.name,
            image: primary?.url ?? null,
            price: getEffectivePrice(p),
          };
        }),
      );
      setLoading(false);
    }, 250);

    return () => {
      clearTimeout(loadingHandle);
      clearTimeout(handle);
    };
  }, [value]);

  function submitQuery(query: string) {
    if (!query) return;
    router.push(`/shop?q=${encodeURIComponent(query)}`);
    onClose();
  }

  return (
    <div
      id="header-search"
      className="border-t border-(--color-hairline) bg-(--color-surface) px-6 py-5"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuery(value.trim());
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-(--color-muted)">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-[2px] border border-(--color-hairline) bg-(--color-canvas) py-2.5 ps-10 pe-3.5 text-sm text-(--color-ink) outline-none transition-colors placeholder:text-(--color-muted) focus-visible:border-(--color-primary) motion-reduce:transition-none"
            />
          </div>
          <button type="submit" className={buttonVariants({ variant: "primary", size: "md" })}>
            {t("search")}
          </button>
        </form>

        {value.trim().length >= 2 && (
          <div className="mt-3 divide-y divide-(--color-hairline) border border-(--color-hairline) bg-(--color-surface)">
            {loading ? (
              <p className="px-4 py-3 text-sm text-(--color-muted)">{t("searching")}</p>
            ) : suggestions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-(--color-muted)">{t("noResults")}</p>
            ) : (
              <>
                {suggestions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/products/${s.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--color-canvas) motion-reduce:transition-none"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[2px] bg-(--color-hairline)/40">
                      {s.image && (
                        <Image src={s.image} alt="" fill sizes="48px" className="object-cover" />
                      )}
                    </div>
                    <span className="flex-1 truncate text-sm text-(--color-ink)">{s.name}</span>
                    <span className="font-mono-label text-xs text-(--color-muted)">
                      {formatAED(s.price.finalPrice)}
                    </span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => submitQuery(value.trim())}
                  className="block w-full px-4 py-3 text-start font-mono-label text-[11px] text-(--color-primary) hover:bg-(--color-canvas)"
                >
                  {t("viewAllResults", { query: value.trim() })}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 16L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
