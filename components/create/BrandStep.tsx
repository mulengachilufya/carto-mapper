"use client";

import { Button } from "@/components/ui/Button";

interface Brand {
  title: string;
  organisation: string;
  logoDataUrl: string | null;
  notes: string;
}

interface Props extends Brand {
  onChange: (patch: Partial<Brand>) => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
}

const INPUT =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent";

export function BrandStep({ title, organisation, logoDataUrl, notes, onChange, onBack, onGenerate, generating }: Props) {
  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Make it yours</h2>
      <p className="mt-1.5 text-muted">Title, organisation, logo, and any caption — these go straight onto the map.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Map title">
          <input
            value={title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Beneficiaries by District, 2026"
            className={INPUT}
          />
        </Field>

        <Field label="Organisation (optional)">
          <input
            value={organisation}
            onChange={(e) => onChange({ organisation: e.target.value })}
            placeholder="e.g. Lenga Maps"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Logo (optional)">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-line bg-paper px-3.5 py-2 text-sm hover:bg-paper-2">
              {logoDataUrl ? "Change logo" : "Upload logo"}
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {logoDataUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoDataUrl} alt="logo preview" className="h-10 w-10 rounded border border-line object-contain" />
                <button type="button" onClick={() => onChange({ logoDataUrl: null })} className="text-sm text-muted hover:text-ink">
                  Remove
                </button>
              </>
            )}
          </div>
        </Field>

        <Field label="Caption / notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            placeholder="A short caption or source line for the map."
            className={`${INPUT} resize-none`}
          />
        </Field>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">← Back</Button>
        <Button onClick={onGenerate} disabled={generating} size="lg">
          {generating ? "Designing your map…" : "Generate my map"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
