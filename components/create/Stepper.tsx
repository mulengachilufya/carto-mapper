const LABELS = ["Brief", "Map type", "Branding", "Preview"];

export function Stepper({ step }: { step: number }) {
  return (
    <ol className="mx-auto flex max-w-xl items-center justify-between">
      {LABELS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-accent text-white"
                    : state === "current"
                      ? "border-2 border-accent text-accent"
                      : "border border-line text-muted"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={`hidden text-sm sm:inline ${state === "todo" ? "text-muted" : "text-ink"}`}>
                {label}
              </span>
            </div>
            {i < LABELS.length - 1 && (
              <span className={`mx-3 h-px flex-1 ${i < step ? "bg-accent" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
