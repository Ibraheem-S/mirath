import type { CalcResult } from "@/engine";
import { fmt, fmtPct, frac } from "@/engine";
import { SectionShell } from "@/components/SectionShell";
import { InfoTip } from "@/components/InfoTip";
import { StarDivider } from "@/components/Star";
import { AlertOctagon, AlertTriangle, Info, Printer } from "lucide-react";

const money = (v: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(v);

const KIND_LABEL: Record<string, string> = {
  fard: "Fixed share",
  asaba: "Residuary",
  "asaba-maa": "Residuary (with another)",
  "fard+asaba": "Fixed + residue",
  radd: "Fixed + radd",
};

export function ResultsSection({ result }: { result: CalcResult }) {
  const { messages, allocations, pipeline, steps, exclusions, specialCases } = result;
  const errors = messages.filter((m) => m.severity === "error");
  const warnings = messages.filter((m) => m.severity === "warning");
  const cur = pipeline?.currency ?? "USD";

  return (
    <SectionShell
      id="results"
      no="05"
      title="The Distribution"
      arabic="قسمة التركة"
      lede="The exact Quranic distribution of the net estate. Hover or tap the circled-i on any row to see the underlying arithmetic and its textual evidence."
    >
      {/* ---- messages ---- */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-5 space-y-2">
          {errors.map((m, i) => (
            <div key={`e${i}`} className="flex gap-3 border border-blood/60 bg-blood/10 p-3.5">
              <AlertOctagon className="mt-0.5 shrink-0 text-blood" size={18} />
              <div>
                <p className="text-sm font-semibold text-blood">Inconsistent selection</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink">{m.message}</p>
                {m.suggestion && (
                  <p className="mt-1 text-sm font-medium text-leaf">→ {m.suggestion}</p>
                )}
              </div>
            </div>
          ))}
          {warnings.map((m, i) => (
            <div key={`w${i}`} className="flex gap-3 border border-gilt/70 bg-gilt-wash p-3.5">
              <AlertTriangle className="mt-0.5 shrink-0 text-gilt" size={18} />
              <div>
                <p className="text-sm font-semibold text-ink">Legal caution</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink">{m.message}</p>
                {m.suggestion && (
                  <p className="mt-1 text-sm font-medium text-leaf">→ {m.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!result.ok ? (
        <div className="border border-ink/20 bg-paper-card p-6 text-center">
          <p className="font-display text-lg text-ink">
            Resolve the {errors.length} issue{errors.length === 1 ? "" : "s"} above to compute the distribution.
          </p>
        </div>
      ) : (
        <>
          {/* ---- estate pipeline ---- */}
          {pipeline && (
            <div className="border border-ink/20 bg-paper-card">
              <h3 className="border-b border-ink/15 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">
                Order of charges <span className="arabic normal-case tracking-normal">— الترتيب</span>
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <PipeRow label="Gross estate" value={pipeline.gross} cur={cur} tip="Everything owned at death, before any deduction." />
                  <PipeRow label="− Funeral & burial costs" value={-pipeline.funeral} cur={cur} tip="First charge by consensus of the four schools." />
                  <PipeRow label="− Debts" value={-pipeline.debts} cur={cur} tip="Quran 4:11 — 'after any bequest or debt'. Includes unpaid zakat per most scholars." />
                  <PipeRow
                    label={`− Bequest (wasiyya)`}
                    value={-pipeline.wasiyyaApplied}
                    cur={cur}
                    tip={`Capped at one third after debts: ${money(pipeline.wasiyyaAllowedCap, cur)} (Bukhari 2742; Muslim 1628). ${pipeline.wasiyyaApplied < pipeline.wasiyyaAllowedCap || pipeline.wasiyyaApplied === 0 ? "" : "The cap was applied."}`}
                    warn={pipeline.wasiyyaApplied >= pipeline.wasiyyaAllowedCap && pipeline.wasiyyaAllowedCap > 0}
                  />
                  <tr className="border-t-2 border-ink bg-leaf-mist">
                    <td className="px-4 py-2.5 font-display text-base font-semibold text-leaf">
                      Net estate for the heirs (mirath)
                      <span className="ml-2 align-middle"><InfoTip label="Net estate">This is the amount the fractions below are applied to. Quran 4:11–12 fix the order: debts and bequests first, inheritance second.</InfoTip></span>
                    </td>
                    <td className="num px-4 py-2.5 text-right font-display text-base font-bold text-leaf">
                      {money(pipeline.netMirath, cur)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ---- special cases ---- */}
          {specialCases.length > 0 && (
            <div className="mt-4 space-y-2">
              {specialCases.map((s, i) => (
                <div key={i} className="flex gap-3 border border-leaf/40 bg-leaf-mist p-3.5">
                  <Info className="mt-0.5 shrink-0 text-leaf" size={18} />
                  <p className="text-sm leading-relaxed text-ink">{s}</p>
                </div>
              ))}
            </div>
          )}

          {/* ---- allocation table ---- */}
          <div className="mt-4 overflow-x-auto border border-ink/20 bg-paper-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-left">
                  <th className="px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Heir</th>
                  <th className="px-2 py-2.5 text-right font-display text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Share</th>
                  <th className="px-2 py-2.5 text-right font-display text-xs font-semibold uppercase tracking-[0.14em] text-leaf">%</th>
                  <th className="px-2 py-2.5 text-right font-display text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Each</th>
                  <th className="px-4 py-2.5 text-right font-display text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => {
                  const shareFrac = frac(a.shareTotalNum, a.shareTotalDen);
                  const zero = a.shareTotalNum === 0;
                  return (
                    <tr key={i} className={`border-b border-ink/10 align-top ${zero ? "opacity-55" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-ink">{a.label}</span>
                          <InfoTip label={`Why ${a.label} inherits this`}>
                            <p className="font-semibold text-gilt-soft">{a.reason}</p>
                            <p className="mt-1.5 border-t border-paper/20 pt-1.5">{a.math}</p>
                            <p className="mt-1.5 text-[11px] uppercase tracking-wide text-gilt-soft">
                              Evidence: {a.evidence.join(" · ")}
                            </p>
                            {a.madhhabNote && (
                              <p className="mt-1.5 border-t border-paper/20 pt-1.5 text-[11.5px] italic text-paper/80">
                                {a.madhhabNote}
                              </p>
                            )}
                          </InfoTip>
                        </div>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-faint">
                          {KIND_LABEL[a.kind] ?? a.kind}
                        </p>
                        {a.perHead && (
                          <p className="num mt-1 text-xs text-ink-soft">
                            {a.perHead.maleCount} × male: {money(a.perHead.maleAmount, cur)} ·{" "}
                            {a.perHead.femaleCount} × female: {money(a.perHead.femaleAmount, cur)}
                          </p>
                        )}
                      </td>
                      <td className="fraction px-2 py-3 text-right text-lg font-semibold text-ink">
                        {zero ? "—" : fmt(shareFrac)}
                      </td>
                      <td className="num px-2 py-3 text-right text-ink-soft">
                        {zero ? "0%" : fmtPct(shareFrac)}
                      </td>
                      <td className="num px-2 py-3 text-right text-ink-soft">
                        {zero || a.perHead
                          ? "—"
                          : a.count > 1
                            ? `${fmt(frac(a.shareEachNum, a.shareEachDen))}`
                            : "—"}
                      </td>
                      <td className="num px-4 py-3 text-right font-semibold text-ink">
                        {zero ? money(0, cur) : money(a.amountTotal, cur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink bg-paper-deep">
                  <td className="px-4 py-2.5 font-display text-sm font-semibold text-ink">
                    Total {result.base ? `(base ${result.base}${result.awlApplied ? " after 'awl" : ""})` : ""}
                  </td>
                  <td className="fraction px-2 py-2.5 text-right font-semibold">1</td>
                  <td className="num px-2 py-2.5 text-right font-semibold">100%</td>
                  <td />
                  <td className="num px-4 py-2.5 text-right font-semibold">
                    {pipeline ? money(pipeline.netMirath, cur) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(result.awlApplied || result.raddApplied) && (
            <p className="mt-2 text-xs text-ink-soft">
              {result.awlApplied &&
                "'Awl applied: the Quranic shares exceeded the estate, so every share was reduced proportionally (Umar's ruling, all four Sunni schools). "}
              {result.raddApplied &&
                "Radd applied: a surplus remained with no residuary, so it was returned proportionally to the eligible fixed-share heirs."}
            </p>
          )}

          {/* ---- exclusions ---- */}
          {exclusions.length > 0 && (
            <details className="mt-4 border border-ink/20 bg-paper-card">
              <summary className="cursor-pointer px-4 py-2.5 font-display text-sm font-semibold text-leaf">
                Excluded relatives ({exclusions.length}) — who was blocked, and why
              </summary>
              <ul className="space-y-2 border-t border-ink/10 px-4 py-3">
                {exclusions.map((e, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink">
                    <span className="font-medium">{e.label}</span>{" "}
                    <span className="text-ink-faint">blocked by {e.blocker}.</span>{" "}
                    <span className="text-ink-soft">{e.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* ---- audit trail ---- */}
          <details className="mt-3 border border-ink/20 bg-paper-card">
            <summary className="cursor-pointer px-4 py-2.5 font-display text-sm font-semibold text-leaf">
              Full calculation record — step by step
            </summary>
            <ol className="space-y-3 border-t border-ink/10 px-4 py-4">
              {steps.map((s, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  <span className="font-display font-semibold text-gilt">
                    {String(i + 1).padStart(2, "0")}
                  </span>{" "}
                  <span className="font-semibold text-ink">{s.title}.</span>{" "}
                  <span className="text-ink-soft">{s.detail}</span>
                </li>
              ))}
            </ol>
          </details>

          <div className="no-print mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 border border-leaf bg-leaf px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-leaf-bright"
            >
              <Printer size={15} /> Print / save as PDF
            </button>
            <p className="text-xs text-ink-soft">
              Amounts are rounded to two decimals for display; the governing values are the exact
              fractions shown.
            </p>
          </div>
        </>
      )}

      <StarDivider className="mt-8" />
      <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
        This tool computes the Sunni law of inheritance (four schools) to the best of published
        jurisprudence. It is an educational aid, not a fatwa: complex estates — unborn children,
        missing persons, simultaneous deaths, non-Muslim relatives, or compound grandfather cases —
        need a qualified scholar. Full derivations and sources accompany this app in the{" "}
        <code className="text-[11px]">docs/</code> folder.
      </p>
    </SectionShell>
  );
}

function PipeRow({
  label, value, cur, tip, warn,
}: {
  label: string; value: number; cur: string; tip: string; warn?: boolean;
}) {
  return (
    <tr className="border-b border-ink/10">
      <td className="px-4 py-2 text-ink">
        {label}
        <span className="ml-2 align-middle"><InfoTip label={label}>{tip}</InfoTip></span>
      </td>
      <td className={`num px-4 py-2 text-right ${warn ? "font-semibold text-gilt" : "text-ink"}`}>
        {money(value, cur)}
      </td>
    </tr>
  );
}
