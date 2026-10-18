import { SectionShell } from "@/components/SectionShell";

const VERSES = [
  {
    ref: "Quran 4:11",
    text: "Children and parents: the male's share as two females; daughters ½ or ⅔; each parent ⅙ with a child; the mother ⅓ without.",
  },
  {
    ref: "Quran 4:12",
    text: "Spouses and uterine siblings: husband ½ / ¼; wives ¼ / ⅛; a uterine sibling ⅙, several share ⅓ equally.",
  },
  {
    ref: "Quran 4:176",
    text: "Kalala: the full sister's ½, two sisters ⅔; siblings of both genders sharing 2:1.",
  },
];

const HADITH = [
  { ref: "Sahih al-Bukhari 6732", text: "'Give the fixed shares to those entitled; what remains belongs to the closest male relative.'" },
  { ref: "Sahih al-Bukhari 2742 · Sahih Muslim 1628", text: "Bequests limited to one third: 'A third — and a third is much.'" },
  { ref: "Jami' at-Tirmidhi 2120 · Abu Dawud 2870", text: "'There is no bequest for an heir' — unless all adult heirs consent after death." },
  { ref: "Abu Dawud 2894 · Tirmidhi 2100", text: "The grandmother's fixed sixth." },
];

export function MethodSection() {
  return (
    <SectionShell
      id="method"
      no="07"
      title="Method & Sources"
      arabic="المنهج"
      lede="How this tool computes, and on what authorities. The complete treatment — every rule, every divergence, worked examples — ships as Markdown documents alongside the app."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">Primary texts</h3>
          <ul className="mt-3 space-y-3">
            {VERSES.map((v) => (
              <li key={v.ref} className="border-l-2 border-gilt pl-3">
                <p className="text-sm font-semibold text-ink">{v.ref}</p>
                <p className="text-sm leading-relaxed text-ink-soft">{v.text}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">Hadith &amp; Companion rulings</h3>
          <ul className="mt-3 space-y-3">
            {HADITH.map((h) => (
              <li key={h.ref} className="border-l-2 border-leaf pl-3">
                <p className="text-sm font-semibold text-ink">{h.ref}</p>
                <p className="text-sm leading-relaxed text-ink-soft">{h.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">The computation pipeline</h3>
          <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            {[
              "Validate the inputs — impossible constellations (five widows, insolvent estates, bequests to heirs) are stopped with an explanation and a suggested fix.",
              "Charge the estate: funeral costs, debts, then the bequest within its third.",
              "Apply hajb (exclusion): nearer heirs block farther ones per the matrix in docs §4.",
              "Assign the fixed Quranic shares (ashab al-furud) — ½, ¼, ⅛, ⅔, ⅓, ⅙.",
              "Sweep the residue to the 'asaba chain: sons, son's sons, father, grandfather, brothers, nephews, uncles.",
              "Reconcile: 'awl reduces shares proportionally when they overflow; radd returns a surplus proportionally — each per the school options chosen.",
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display font-semibold text-gilt">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">Documentation set</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            {[
              ["00-overview.md", "scope, pipeline, disclaimers"],
              ["01-legal-basis.md", "Quran, Sunnah, ijma' foundations"],
              ["02-calculation-pipeline.md", "estate charges, asl, 'awl, radd"],
              ["03-heir-shares.md", "every heir, share, condition, evidence"],
              ["04-exclusion-hajb.md", "the full blocking matrix"],
              ["05-madhhab-differences.md", "grandfather, mushtaraka, radd, dhawu'l-arham, grandmothers"],
              ["06-special-cases.md", "al-Umariyyatayn, al-Mushtaraka, al-Akdariyya, kalala"],
              ["07-validation-rules.md", "every error message and its juristic ground"],
              ["08-engine-api.md", "technical reference for the calculation engine"],
              ["09-jafari-notes.md", "how the Ja'fari system differs (documented, not computed)"],
              ["10-will-document.md", "the downloadable wasiyya PDF: structure and drafting choices"],
              ["11-accounts-privacy.md", "the local account framework and its GDPR/CCPA compliance design"],
            ].map(([f, d]) => (
              <li key={f} className="flex gap-2">
                <code className="shrink-0 text-[12px] text-leaf">{f}</code>
                <span className="text-ink-faint">— {d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
