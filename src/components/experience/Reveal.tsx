"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-triggered entrance. Content renders normally; the entrance only plays the first time the
 * element scrolls into view. Reduced-motion users see it immediately (see globals.css).
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "header" | "article";
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"pending" | "in">("pending");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    const fallback = setTimeout(() => setState("in"), 2500); // never leave content hidden
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return (
    <Tag
      id={id}
      ref={ref as never}
      data-state={state}
      className={`reveal ${className}`}
      style={{ ["--d" as string]: `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
