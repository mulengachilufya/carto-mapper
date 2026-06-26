"use client";

import { getIndustry, type Question } from "@/lib/industries";
import { Button } from "@/components/ui/Button";

interface Props {
  industryId: string;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuestionsStep({ industryId, answers, onChange, onBack, onNext }: Props) {
  const industry = getIndustry(industryId);
  if (!industry) return null;

  const set = (id: string, value: string) => onChange({ ...answers, [id]: value });
  const allAnswered = industry.questions.every((q) => answers[q.id]);

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">A few quick questions</h2>
      <p className="mt-1.5 text-muted">
        These shape the map — type, projection, colours and what to show. {industry.name}.
      </p>

      <div className="mt-6 space-y-6">
        {industry.questions.map((q, i) => (
          <QuestionField key={q.id} index={i + 1} question={q} value={answers[q.id]} onSelect={(v) => set(q.id, v)} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">
          ← Back
        </Button>
        <Button onClick={onNext} disabled={!allAnswered} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  onSelect,
}: {
  index: number;
  question: Question;
  value?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[15px] font-medium">
        <span className="mr-2 text-muted">{index}.</span>
        {question.label}
      </legend>
      {question.help && <p className="mt-1 text-[13px] text-muted">{question.help}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-paper text-ink hover:border-accent/50 hover:bg-paper-2"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
