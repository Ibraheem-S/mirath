import type { Madhhab, RuleOptions } from "@/engine";
import { resolveRules } from "@/engine";
import { SectionShell } from "@/components/SectionShell";
import { InfoTip } from "@/components/InfoTip";

const MADHHABS: { id: Madhhab; name: string; note: string }[] = [
  { id: "hanafi", name: "Hanafi", note: "Abu Hanifa (d. 767) — Kufa/Baghdad; dominant in Turkey, the Balkans, South & Central Asia." },
  { id: "maliki", name: "Maliki", note: "Malik ibn Anas (d. 795) — Medina; dominant in North & West Africa." },
  { id: "shafii", name: "Shafi'i", note: "Al-Shafi'i (d. 820) — Egypt/Baghdad; dominant in East Africa, Southeast Asia, Yemen." },
  { id: "hanbali", name: "Hanbali", note: "Ahmad ibn Hanbal (d. 855) — Baghdad; dominant in the Gulf." },
];

interface DiffOption<T extends string> {
  key: keyof RuleOptions;
  title: string;
  question: string;
  choices: { value: T; label: string; schools: string; detail: string }[];
}

const GRANDFATHER: DiffOption<"exclude" | "share"> = {
  key: "grandfatherWithSiblings",
  title: "Grandfather alongside siblings",
  question: "When the deceased leaves a grandfather and siblings (no father, no children) — do the siblings inherit?",
  choices: [
    {
      value: "exclude",
      label: "Grandfather excludes siblings",
      schools: "Hanafi — position of Abu Bakr al-Siddiq",
      detail:
        "The grandfather is treated exactly like the father: 'he who blocks the father blocks with him'. Siblings receive nothing.",
    },
    {
      value: "share",
      label: "Siblings share with him (muqasama)",
      schools: "Maliki, Shafi'i, Hanbali — position of Zayd ibn Thabit, Uthman, Ali",
      detail:
        "The grandfather takes the best of three computations: ⅙ of the estate, ⅓ of the residue, or sharing with the brothers as one of them. The siblings take the remainder.",
    },
  ],
};

const MUSHTARAKA: DiffOption<"share" | "exclude"> = {
  key: "mushtaraka",
  title: "Al-Mushtaraka case",
  question: "Husband + mother + uterine siblings + full brothers: may the full brothers join the uterine third?",
  choices: [
    {
      value: "share",
      label: "Full brothers join the ⅓",
      schools: "Maliki, Shafi'i, Hanbali — ruling of Umar and Zayd",
      detail:
        "In this famous case the full brothers share the uterine siblings' ⅓ equally, head for head, because the full brothers' only route to anything is through the same mother-side pool.",
    },
    {
      value: "exclude",
      label: "Full brothers get nothing",
      schools: "Hanafi",
      detail:
        "Abu Hanifa reads Quran 4:12 as reserving the ⅓ to uterine siblings alone; nothing remains for the full brothers after the fixed shares.",
    },
  ],
};

const SPOUSE_RADD: DiffOption<"no" | "yes"> = {
  key: "spouseRadd",
  title: "Radd (surplus return) to the spouse",
  question: "If a surplus remains and the only heir is a spouse — may the spouse take the surplus?",
  choices: [
    {
      value: "no",
      label: "No radd to the spouse",
      schools: "Classical Hanafi",
      detail:
        "The spouse inherits by marriage contract, not kinship, so radd returns only to blood relatives. The surplus passes to distant kin or the public treasury (modern Hanafi codes often reverse this).",
    },
    {
      value: "yes",
      label: "Spouse receives radd",
      schools: "Maliki, Shafi'i, Hanbali — and later Hanafi legislation (e.g. Ottoman family law)",
      detail:
        "When no blood heir exists at all, the surplus returns to the spouse — the marriage bond is a valid heirship route, and the treasury is only a last resort.",
    },
  ],
};

const DHAWU_ARHAM: DiffOption<"inherit" | "treasury"> = {
  key: "dhawuArham",
  title: "Distant uterine kin (dhawu'l-arham)",
  question: "If no Quranic or agnate heir exists — who takes the estate?",
  choices: [
    {
      value: "inherit",
      label: "Distant kin inherit",
      schools: "Hanafi, Hanbali",
      detail:
        "Daughters' children, sisters' children, maternal aunts and uncles and similar womb-kin inherit in a prescribed order before the treasury.",
    },
    {
      value: "treasury",
      label: "Public treasury (bayt al-mal)",
      schools: "Maliki, Shafi'i",
      detail:
        "The estate escheats to the Muslim public treasury for communal benefit; distant uterine kin are not legal heirs. Where no functioning treasury exists, the estate is given in charity.",
    },
  ],
};

export function SchoolSection({
  options,
  onChange,
}: {
  options: RuleOptions;
  onChange: (o: RuleOptions) => void;
}) {
  const applied = resolveRules(options);

  const renderDiff = <T extends string>(diff: DiffOption<T>) => {
    const value = (applied[diff.key] as unknown as T) ?? diff.choices[0].value;
    const overridden = options[diff.key] !== undefined;
    return (
      <div key={diff.key} className="border border-ink/15 bg-paper-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-base font-semibold text-ink">{diff.title}</h4>
          <InfoTip label={`About ${diff.title}`}>
            <p className="font-semibold text-gilt-soft">{diff.question}</p>
            {diff.choices.map((c) => (
              <p key={String(c.value)} className="mt-1.5">
                <span className="font-semibold">{c.label}</span>{" "}
                <span className="text-gilt-soft">({c.schools})</span> — {c.detail}
              </p>
            ))}
          </InfoTip>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{diff.question}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {diff.choices.map((c) => {
            const active = value === c.value;
            return (
              <button
                key={String(c.value)}
                type="button"
                onClick={() => onChange({ ...options, [diff.key]: c.value })}
                className={`border p-3 text-left transition-colors ${
                  active
                    ? "border-leaf bg-leaf-mist ring-1 ring-leaf"
                    : "border-ink/20 bg-paper hover:border-leaf/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                      active ? "border-leaf" : "border-ink/40"
                    }`}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-leaf" />}
                  </span>
                  <span className="text-sm font-semibold text-ink">{c.label}</span>
                </div>
                <p className="mt-1 pl-5 text-[11px] font-medium uppercase tracking-wide text-gilt">
                  {c.schools}
                </p>
                <p className="mt-1 pl-5 text-xs leading-relaxed text-ink-soft">{c.detail}</p>
              </button>
            );
          })}
        </div>
        {overridden && (
          <p className="mt-2 text-[11px] text-gilt">
            Customised — differs from the {options.madhhab} default for this question.
          </p>
        )}
      </div>
    );
  };

  return (
    <SectionShell
      id="school"
      no="04"
      title="School & Juristic Options"
      arabic="المذهب"
      lede="The four Sunni schools agree on the Quranic shares themselves; they diverge on a small set of famous cases. Pick your school's baseline, then review each divergence below — every option shows which schools hold which position."
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MADHHABS.map((m) => {
          const active = options.madhhab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ madhhab: m.id })}
              className={`border p-3 text-left transition-colors ${
                active ? "border-leaf bg-leaf text-paper" : "border-ink/20 bg-paper-card hover:border-leaf/50"
              }`}
            >
              <span className={`font-display text-lg font-semibold ${active ? "text-gilt-soft" : "text-ink"}`}>
                {m.name}
              </span>
              <p className={`mt-1 text-[11.5px] leading-snug ${active ? "text-paper/85" : "text-ink-soft"}`}>
                {m.note}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Selecting a school resets the four questions below to that school's defaults; you can still
        override any of them individually. The Ja'fari (Twelver Shia) system differs more deeply —
        no 'awl, class-based exclusion, and different residue rules — and is documented, but not
        computed, in this tool (see docs §9).
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {renderDiff(GRANDFATHER)}
        {renderDiff(MUSHTARAKA)}
        {renderDiff(SPOUSE_RADD)}
        {renderDiff(DHAWU_ARHAM)}
      </div>
    </SectionShell>
  );
}
