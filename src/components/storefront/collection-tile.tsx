"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

// One photo card in the "Shop by occasion" row. If the photo is missing or fails
// to load (a bad upload, a deleted file), it falls back to a soft branded
// panel instead of a broken-image icon.
export function CollectionTile({
  href,
  title,
  body,
  image,
  index,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  image: string | null;
  index: number;
  cta: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = image && !failed;

  return (
    <Link
      href={href}
      aria-label={`${title}: ${cta}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden bg-gradient-to-br from-(--color-primary)/90 to-(--color-ink) p-5 text-white md:p-6"
    >
      {showImage && (
        <Image
          src={image}
          alt=""
          fill
          quality={75}
          sizes="(min-width: 1024px) 25vw, 50vw"
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-(--color-ink)/90 via-(--color-ink)/30 to-(--color-ink)/30" />

      <div className="relative flex items-start justify-between">
        <span className="font-mono-label text-[11px] tracking-[0.18em] text-white/80">
          0{index + 1}
        </span>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 text-sm transition-colors duration-300 group-hover:border-white group-hover:bg-white group-hover:text-(--color-ink) rtl:rotate-180"
        >
          →
        </span>
      </div>

      <div className="relative flex flex-col gap-2">
        <h3 className="font-display text-[1.7rem] leading-[1.05] md:text-3xl">{title}</h3>
        <p className="text-sm text-white/80">{body}</p>
      </div>
    </Link>
  );
}
