"use client";

import { useEffect, useRef } from "react";

/** The brand compass — its needle tracks the cursor on desktop, like an instrument. */
export function CompassMark() {
  const needleRef = useRef<SVGGElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = wrapRef.current;
        const needle = needleRef.current;
        if (!el || !needle) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        needle.style.transform = `rotate(${angle}deg)`;
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={wrapRef} className="inline-flex">
      <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden>
        <circle cx="32" cy="32" r="29.5" stroke="var(--color-atlas-ochre)" strokeWidth="2.6" />
        <g stroke="var(--color-atlas-ocean)" strokeWidth="0.8" opacity="0.35">
          <circle cx="32" cy="32" r="21" />
          <ellipse cx="32" cy="32" rx="10.5" ry="21" />
          <line x1="32" y1="11" x2="32" y2="53" />
          <line x1="11" y1="32" x2="53" y2="32" />
        </g>
        <g stroke="var(--color-atlas-ochre)" strokeLinecap="round">
          <line x1="32.00" y1="8.80" x2="32.00" y2="5.00" strokeWidth="1.6" />
          <line x1="41.41" y1="9.27" x2="42.33" y2="7.06" strokeWidth="0.9" />
          <line x1="49.39" y1="14.61" x2="51.09" y2="12.91" strokeWidth="0.9" />
          <line x1="54.73" y1="22.59" x2="56.94" y2="21.67" strokeWidth="0.9" />
          <line x1="55.20" y1="32.00" x2="59.00" y2="32.00" strokeWidth="1.6" />
          <line x1="54.73" y1="41.41" x2="56.94" y2="42.33" strokeWidth="0.9" />
          <line x1="49.39" y1="49.39" x2="51.09" y2="51.09" strokeWidth="0.9" />
          <line x1="41.41" y1="54.73" x2="42.33" y2="56.94" strokeWidth="0.9" />
          <line x1="32.00" y1="55.20" x2="32.00" y2="59.00" strokeWidth="1.6" />
          <line x1="22.59" y1="54.73" x2="21.67" y2="56.94" strokeWidth="0.9" />
          <line x1="14.61" y1="49.39" x2="12.91" y2="51.09" strokeWidth="0.9" />
          <line x1="9.27" y1="41.41" x2="7.06" y2="42.33" strokeWidth="0.9" />
          <line x1="8.80" y1="32.00" x2="5.00" y2="32.00" strokeWidth="1.6" />
          <line x1="9.27" y1="22.59" x2="7.06" y2="21.67" strokeWidth="0.9" />
          <line x1="14.61" y1="14.61" x2="12.91" y2="12.91" strokeWidth="0.9" />
          <line x1="22.59" y1="9.27" x2="21.67" y2="7.06" strokeWidth="0.9" />
        </g>
        <g
          ref={needleRef}
          style={{ transformOrigin: "32px 32px", transition: "transform 0.5s cubic-bezier(0.2,0.7,0.2,1)" }}
        >
          <polygon points="32,6.5 37.2,32 26.8,32" fill="var(--color-atlas-ochre)" />
          <polygon points="32,6.5 32,32 26.8,32" fill="var(--color-atlas-paper)" opacity="0.42" />
          <polygon points="26.8,32 37.2,32 32,57.5" fill="var(--color-atlas-deep)" />
        </g>
        <circle cx="32" cy="32" r="3" fill="var(--color-atlas-paper)" stroke="var(--color-atlas-ochre)" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
