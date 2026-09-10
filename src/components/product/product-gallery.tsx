"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
}: {
  images: { url: string; alt: string }[];
}) {
  const t = useTranslations("Pdp");
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-[2px] bg-(--color-hairline)/40">
        {current && (
          <Image
            src={current.url}
            alt={current.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t("showImage", { n: i + 1 })}
              aria-current={i === active}
              className={cn(
                "relative aspect-square overflow-hidden rounded-[2px] border",
                i === active ? "border-(--color-primary)" : "border-(--color-hairline)",
              )}
            >
              <Image src={img.url} alt="" fill sizes="10vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
