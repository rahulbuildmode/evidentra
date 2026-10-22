const STEPS = [
  { k: "AI proposes", tone: "text-ultra border-ultra/40", body: "Gemini identifies potential evidence, inconsistencies, and questions." },
  {
    k: "Code verifies",
    tone: "text-ion border-ion/40",
    body: "Evidentra checks quotations against extracted text and runs deterministic comparisons where applicable.",
  },
  {
    k: "Human decides",
    tone: "text-lime border-lime/40",
    body: "A reviewer determines whether a finding is meaningful, whether a document gap is real, and what action to take.",
  },
];

/** The architecture in one line: AI proposes → Code verifies → Human decides. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mt-10">
      <h3 id="how-title" className="font-mono text-[11px] uppercase tracking-[0.24em] text-porcelain/50">
        How it works
      </h3>
      <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        {STEPS.map((s, i) => (
          <li key={s.k} className="contents">
            {i > 0 && (
              <span aria-hidden className="hidden self-center text-xl text-porcelain/30 md:block">
                →
              </span>
            )}
            <div className={`rounded-xl border bg-obsidian/40 p-4 ${s.tone.split(" ")[1]}`}>
              <div className={`text-sm font-semibold ${s.tone.split(" ")[0]}`}>{s.k}</div>
              <p className="mt-1 text-sm text-porcelain/70">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-porcelain/45">A verified quotation proves the text exists on that page — not that the AI&apos;s interpretation of it is correct.</p>
    </section>
  );
}
