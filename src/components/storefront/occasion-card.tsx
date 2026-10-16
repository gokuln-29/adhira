"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

const SLIDE_MS = 5200;
const FADE_MS = 1200;

// A large photo card that cross-fades through several photos with a slow
// zoom-in / zoom-out on each. It pauses while hovered or focused, while
// scrolled off-screen, and while the tab is hidden; and it stays still for
// visitors who ask for reduced motion.
export function OccasionCard({
  href,
  title,
  body,
  cta,
  images,
  index,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
  images: string[];
  index: number;
}) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const slides = images.filter((src) => !failed.has(src));
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.25,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const playing = slides.length > 1 && inView && !hovering && !reduced;

  useEffect(() => {
    if (!playing) return;
    // Cards start a beat apart so the four never change in lockstep.
    const first = active === 0 ? SLIDE_MS + index * 700 : SLIDE_MS;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % slides.length), first);
    const onHidden = () => document.hidden && window.clearTimeout(timer);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [playing, active, slides.length, index]);

  const current = slides.length ? active % slides.length : 0;

  return (
    <Link
      ref={cardRef}
      href={href}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden bg-gradient-to-br from-(--color-primary)/90 to-(--color-ink) p-6 text-white sm:aspect-[5/4] md:p-9"
    >
      {/* Photos: one visible at a time, each slowly zooming */}
      <div className="absolute inset-0 transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        {slides.map((src, i) => (
          <div
            key={src}
            className={cn(
              "absolute inset-0 transition-opacity ease-in-out",
              i === current ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <Image
              src={src}
              alt=""
              fill
              quality={80}
              sizes="(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw"
              priority={index < 2 && i === 0}
              onError={() => setFailed((prev) => new Set(prev).add(src))}
              // The zoom class is only on the visible slide, so each slide's
              // zoom restarts from the beginning when it comes back around.
              className={cn(
                "object-cover",
                i === current && (i % 2 === 0 ? "kb-in" : "kb-out"),
              )}
              style={{ "--kb-duration": `${SLIDE_MS + FADE_MS + 1500}ms` } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-(--color-ink)/85 via-(--color-ink)/20 to-(--color-ink)/25" />

      <div className="relative flex items-start justify-between">
        <span className="font-mono-label text-[11px] tracking-[0.18em] text-white/85">0{index + 1}</span>
        {slides.length > 1 && (
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {slides.map((src, i) => (
              <span
                key={src}
                className={cn(
                  "h-[3px] rounded-full bg-white transition-all duration-700",
                  i === current ? "w-7 opacity-100" : "w-3 opacity-40",
                )}
              />
            ))}
          </span>
        )}
      </div>

      <div className="relative flex flex-col gap-3">
        <h3 className="font-display text-4xl leading-none md:text-5xl">{title}</h3>
        <p className="max-w-sm text-sm text-white/85 md:text-base">{body}</p>
        <span className="font-mono-label mt-1 inline-flex w-fit items-center gap-3 text-[11px] tracking-[0.14em]">
          <span className="border-b border-white/50 pb-1 transition-colors group-hover:border-white">{cta}</span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-sm transition-all duration-300 group-hover:translate-x-1 group-hover:border-white group-hover:bg-white group-hover:text-(--color-ink) rtl:rotate-180 rtl:group-hover:-translate-x-1 rtl:group-hover:translate-x-0"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
