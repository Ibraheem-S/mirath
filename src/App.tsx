import { useMemo, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { calculate, emptyFamily, type EstateInput, type FamilyInput, type RuleOptions } from "@/engine";
import { emptyWillMeta, generateWillPdf, type WillMeta } from "@/will/generateWillPdf";
import { AccountProvider } from "@/account/AccountContext";
import { AccountDialog } from "@/account/AccountDialog";
import { Star, StarDivider } from "@/components/Star";
import { DeceasedSection } from "@/sections/DeceasedSection";
import { FamilySection } from "@/sections/FamilySection";
import { EstateSection } from "@/sections/EstateSection";
import { SchoolSection } from "@/sections/SchoolSection";
import { ResultsSection } from "@/sections/ResultsSection";
import { WillSection } from "@/sections/WillSection";
import { MethodSection } from "@/sections/MethodSection";

const NAV = [
  { id: "deceased", no: "01", label: "Deceased" },
  { id: "family", no: "02", label: "Family" },
  { id: "estate", no: "03", label: "Estate" },
  { id: "school", no: "04", label: "School" },
  { id: "results", no: "05", label: "Distribution" },
  { id: "will", no: "06", label: "Will document" },
  { id: "method", no: "07", label: "Method & sources" },
];

export default function App() {
  const [family, setFamily] = useState<FamilyInput>({
    ...emptyFamily,
    deceasedGender: "male",
    wives: 1,
    father: true,
    mother: true,
    sons: 1,
    daughters: 2,
  });
  const [estate, setEstate] = useState<EstateInput>({
    grossEstate: 240000,
    funeralCosts: 6000,
    debts: 14000,
    wasiyyaAmount: 0,
    wasiyyaRecipientIsHeir: false,
    currency: "USD",
  });
  const [options, setOptions] = useState<RuleOptions>({ madhhab: "hanafi" });
  const [willMeta, setWillMeta] = useState<WillMeta>(emptyWillMeta);

  const result = useMemo(() => calculate(family, estate, options), [family, estate, options]);
  const errorCount = result.messages.filter((m) => m.severity === "error").length;

  return (
    <TooltipProvider>
      <AccountProvider
        plan={{ family, estate, options, willMeta }}
        onRestore={(p, _designees, displayName) => {
          setFamily(p.family);
          setEstate(p.estate);
          setOptions(p.options);
          setWillMeta((m) => ({
            ...p.willMeta,
            testatorName: p.willMeta.testatorName || m.testatorName || displayName,
          }));
        }}
      >
      <div className="min-h-screen bg-background">
        {/* ======== masthead ======== */}
        <header className="border-b-2 border-ink bg-paper">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <Star className="text-leaf" size={30} />
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Mīrāth <span className="arabic text-leaf">ميراث</span>
                </h1>
                <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                  Islamic inheritance &amp; will planner
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AccountDialog />
              <p className="max-w-xs text-right text-[11.5px] leading-snug text-ink-faint">
                'Allah instructs you concerning your children…' — Quran 4:11.
                Computed per the four Sunni schools.
              </p>
            </div>
          </div>
          {/* sticky section nav */}
          <nav className="no-print sticky top-0 z-20 border-t border-ink/15 bg-paper/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="flex shrink-0 items-baseline gap-1.5 px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-leaf"
                >
                  <span className="font-display text-xs text-gilt">{n.no}</span>
                  <span className="font-medium">{n.label}</span>
                </a>
              ))}
              {errorCount > 0 && (
                <a
                  href="#results"
                  className="ml-auto flex shrink-0 items-center gap-1.5 border border-blood/50 bg-blood/10 px-2.5 py-1 text-xs font-semibold text-blood"
                >
                  {errorCount} issue{errorCount === 1 ? "" : "s"} to fix
                </a>
              )}
            </div>
          </nav>
        </header>

        {/* ======== lede ======== */}
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
          <p className="max-w-3xl font-display text-xl font-light leading-relaxed text-ink sm:text-2xl">
            Enter the surviving family, the estate, and your school of law — and receive the exact
            shares the Quran prescribes, with every fraction, its arithmetic, and its evidence laid
            bare. <span className="text-leaf">Nothing is hidden; every number opens to show its working.</span>
          </p>
          <StarDivider className="mt-8" />
        </div>

        {/* ======== body ======== */}
        <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
          <DeceasedSection family={family} onChange={(p) => setFamily((f) => ({ ...f, ...p }))} />
          <FamilySection
            family={family}
            exclusions={result.exclusions}
            onChange={(p) => setFamily((f) => ({ ...f, ...p }))}
          />
          <EstateSection estate={estate} onChange={(p) => setEstate((e) => ({ ...e, ...p }))} />
          <SchoolSection options={options} onChange={setOptions} />
          <ResultsSection result={result} />
          <WillSection
            result={result}
            meta={willMeta}
            onMeta={(p) => setWillMeta((m) => ({ ...m, ...p }))}
            onGenerate={(designees) => generateWillPdf(result, family, estate, willMeta, designees)}
          />
          <MethodSection />
        </main>

        {/* ======== footer ======== */}
        <footer className="border-t-2 border-ink bg-paper">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
            <div className="flex items-center gap-2 text-ink-soft">
              <Star size={14} className="text-gilt" />
              <span className="text-xs">
                Mīrāth — faraid computed exactly, in the open. Educational tool, not a fatwa.
              </span>
            </div>
            <span className="arabic text-sm text-leaf">أَلْحِقُوا الْفَرَائِضَ بِأَهْلِهَا</span>
          </div>
        </footer>
      </div>
      </AccountProvider>
    </TooltipProvider>
  );
}
