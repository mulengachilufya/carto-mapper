export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row">
        <p className="font-serif">
          CartoMapper — cartography, by design.
        </p>
        <p className="flex items-center gap-4">
          <span>Boundaries © Natural Earth</span>
          <span aria-hidden>·</span>
          <span>© {new Date().getFullYear()}</span>
        </p>
      </div>
    </footer>
  );
}
