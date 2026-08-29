"use client";

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

interface Props {
  src: string;
  alt: string;
  plate?: string; // e.g. "Plate IV"
  caption?: string;
  ratio?: string; // aspect-ratio CSS value
  rotate?: number; // resting rotation in degrees, for a "pinned" feel
  tilt?: boolean; // pointer-follow 3D tilt
  className?: string;
  priority?: boolean;
}

/** A framed, duotoned photograph — the unit of the "archive" motif. */
export function Plate({
  src,
  alt,
  plate,
  caption,
  ratio = "4 / 5",
  rotate = 0,
  tilt = true,
  className,
  priority,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!tilt || !ref.current || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--tiltX", `${(-py * 6).toFixed(2)}deg`);
    ref.current.style.setProperty("--tiltY", `${(px * 6).toFixed(2)}deg`);
  }
  function onLeave() {
    if (!ref.current) return;
    ref.current.style.setProperty("--tiltX", "0deg");
    ref.current.style.setProperty("--tiltY", "0deg");
  }

  const style: CSSProperties & Record<string, string> = {
    "--tiltX": "0deg",
    "--tiltY": "0deg",
    transform: `rotate(${rotate}deg) rotateX(var(--tiltX)) rotateY(var(--tiltY))`,
    transformStyle: "preserve-3d",
    transition: "transform 0.35s cubic-bezier(0.2,0.7,0.2,1)",
  };

  return (
    <figure
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={style}
      className={`group relative shrink-0 rounded-[3px] bg-room-2 p-2 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65)] ring-1 ring-room-line ${className ?? ""}`}
    >
      <div className="duotone rounded-[2px]" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} />
      </div>

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {(plate || caption) && (
        <figcaption className="mt-2 flex items-baseline justify-between gap-3 px-0.5 pb-0.5">
          {plate && (
            <span className="font-mono-tight text-[10px] uppercase tracking-wider text-brass">{plate}</span>
          )}
          {caption && <span className="truncate text-[11px] text-parchment-muted">{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const pose: Record<string, string> = {
    tl: "top-0.5 left-0.5",
    tr: "top-0.5 right-0.5 -scale-x-100",
    bl: "bottom-0.5 left-0.5 -scale-y-100",
    br: "bottom-0.5 right-0.5 -scale-100",
  };
  return (
    <span className={`reg-mark ${pose[pos]}`} aria-hidden>
      <svg viewBox="0 0 15 15" fill="none">
        <path d="M0.5 6V0.5H6" strokeWidth="1" />
        <circle cx="0.5" cy="0.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
