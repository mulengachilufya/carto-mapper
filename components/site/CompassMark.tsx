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
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="13" cy="13" r="11.25" stroke="var(--color-brass)" strokeWidth="1.25" />
        <circle cx="13" cy="13" r="8.5" stroke="var(--color-brass)" strokeWidth="0.5" opacity="0.4" />
        <g
          ref={needleRef}
          style={{ transformOrigin: "13px 13px", transition: "transform 0.5s cubic-bezier(0.2,0.7,0.2,1)" }}
        >
          <polygon points="13,4.5 15.2,13 13,21.5 10.8,13" fill="var(--color-brass)" />
          <polygon points="13,4.5 13,13 10.8,13" fill="var(--color-paper)" opacity="0.35" />
        </g>
        <circle cx="13" cy="13" r="1.3" fill="var(--color-room)" stroke="var(--color-brass)" strokeWidth="0.75" />
      </svg>
    </span>
  );
}
