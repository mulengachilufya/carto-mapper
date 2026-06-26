const LABELS = ["Industry", "Questions", "Data", "Preview"];

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
                    ? "bg-[--color-accent] text-white"
                    : state === "current"
                      ? "border-2 border-[--color-accent] text-[--color-accent]"
                      : "border border-[--color-line] text-[--color-muted]"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={`hidden text-sm sm:inline ${state === "todo" ? "text-[--color-muted]" : "text-[--color-ink]"}`}>
                {label}
              </span>
            </div>
            {i < LABELS.length - 1 && (
              <span className={`mx-3 h-px flex-1 ${i < step ? "bg-[--color-accent]" : "bg-[--color-line]"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
