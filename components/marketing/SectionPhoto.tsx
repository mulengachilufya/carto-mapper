interface Props {
  src: string;
  alt: string;
  kenBurns?: boolean;
  className?: string;
}

/** Absolute-fill duotoned backdrop. Place inside a `relative` section as the first child. */
export function SectionPhoto({ src, alt, kenBurns, className }: Props) {
  return (
    <div className={`duotone absolute inset-0 ${className ?? ""}`} aria-hidden={!alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={kenBurns ? "ken-burns" : undefined} />
    </div>
  );
}
