"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Fades and lifts its children in the first time they scroll into view.
// Content is fully visible until the browser hydrates, so nothing is ever
// hidden if JavaScript fails; reduced-motion users get no animation (see CSS).
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Milliseconds, to stagger siblings. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Already on screen at load: leave it alone rather than flash it away.
    if (rect.top < window.innerHeight * 0.9) {
      setState("shown");
      return;
    }
    setState("armed");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={cn(state !== "idle" && "reveal", state === "shown" && "is-visible", className)}
    >
      {children}
    </div>
  );
}
