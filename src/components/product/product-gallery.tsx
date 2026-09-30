"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Large product photo with a hover "loupe" zoom that follows the pointer
// (mouse only; on touch screens it is just a clean image), plus thumbnails.
export function ProductGallery({
  images,
}: {
  images: { url: string; alt: string }[];
}) {
  const t = useTranslations("Pdp");
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number; on: boolean }>({ x: 50, y: 50, on: false });
  const current = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-(--color-hairline)/50"
        onMouseEnter={() => setZoom((z) => ({ ...z, on: true }))}
        onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setZoom({
            on: true,
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
          });
        }}
      >
        {current && (
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt}
            fill
            priority
            quality={85}
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="animate-[gallery-in_0.6s_ease-out_both] object-cover transition-transform duration-500 ease-out motion-reduce:animate-none motion-reduce:transition-none"
            style={{
              transformOrigin: `${zoom.x}% ${zoom.y}%`,
              transform: zoom.on ? "scale(1.8)" : "scale(1)",
            }}
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t("showImage", { n: i + 1 })}
              aria-current={i === active}
              className={cn(
                "relative aspect-[4/5] overflow-hidden transition-opacity duration-300",
                i === active ? "opacity-100 ring-1 ring-(--color-ink) ring-offset-2 ring-offset-(--color-canvas)" : "opacity-60 hover:opacity-100",
              )}
            >
              <Image src={img.url} alt="" fill sizes="12vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
