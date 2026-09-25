import { useMemo } from "react";
import type { ExclusionNote, FamilyInput, HeirCategory } from "@/engine";
import { SectionShell } from "@/components/SectionShell";
import { CountField, ToggleField } from "@/components/Field";

/** map family input keys → engine exclusion categories */
const KEY_TO_CATS: Record<string, HeirCategory[]> = {
  paternalGrandfather: ["grandfather"],
  maternalGrandmother: ["grandmother"],
  paternalGrandmother: ["grandmother"],
  sonsSons: ["sonsSon"],
  sonsDaughters: ["sonsDaughter"],
  fullBrothers: ["fullBrother"],
  fullSisters: ["fullSister"],
  paternalBrothers: ["paternalBrother"],
  paternalSisters: ["paternalSister"],
  maternalBrothers: ["maternalBrother"],
  maternalSisters: ["maternalBrother"],
  fullNephews: ["fullNephew"],
  paternalNephews: ["paternalNephew"],
  fullPaternalUncles: ["fullPaternalUncle"],
  paternalUncles: ["paternalUncle"],
};

export function FamilySection({
  family,
  exclusions,
  onChange,
}: {
  family: FamilyInput;
  exclusions: ExclusionNote[];
  onChange: (patch: Partial<FamilyInput>) => void;
}) {
  const blockers = useMemo(() => {
    const map = new Map<string, string>();
    for (const [key, cats] of Object.entries(KEY_TO_CATS)) {
      for (const c of cats) {
        const ex = exclusions.find((e) => e.category === c);
        if (ex && !map.has(key)) map.set(key, ex.blocker);
      }
    }
    return map;
  }, [exclusions]);

  const b = (k: string) => blockers.get(k) ?? null;

  return (
    <SectionShell
      id="family"
      no="02"
      title="The Family"
      arabic="الورثة"
      lede="Everyone who survives the deceased. Relatives blocked by a nearer heir are shown greyed-out with the reason — that is hajb (exclusion), Quran 4:11 read as a system."
    >
      <div className="grid gap-x-10 lg:grid-cols-2">
        {/* ---- ascendants ---- */}
        <div>
          <h3 className="mb-1 border-b border-ink/15 pb-1 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">
            Parents &amp; grandparents
          </h3>
          <ToggleField
            label="Father" arabic="الأب" value={family.father}
            onChange={(v) => onChange({ father: v })}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅙ + residue, or pure residue</p>
                <p className="mt-1">
                  Quran 4:11 fixes the father at ⅙ when any child exists. With only daughters he
                  also sweeps the residue (Bukhari 6732); with no children at all he is the pure
                  residuary. His presence excludes the grandfather and all siblings.
                </p>
              </>
            }
          />
          <ToggleField
            label="Mother" arabic="الأم" value={family.mother}
            onChange={(v) => onChange({ mother: v })}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅓, or ⅙</p>
                <p className="mt-1">
                  Quran 4:11 — the mother takes ⅓, reduced to ⅙ when the deceased left any child or
                  two or more siblings (counted even if those siblings inherit nothing). In the
                  spouse + mother + father case (al-Umariyya) she takes ⅓ of the <em>remainder</em>.
                </p>
              </>
            }
          />
          <ToggleField
            label="Paternal grandfather" arabic="الجد" value={family.paternalGrandfather}
            onChange={(v) => onChange({ paternalGrandfather: v })}
            blocked={b("paternalGrandfather")}
            hint="Father's father (or higher). Inherits only if the father is absent."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Like the father — but siblings?</p>
                <p className="mt-1">
                  With no father, the grandfather takes the father's place. The schools then divide:
                  Hanafi (Abu Bakr's view) — he excludes all siblings exactly like a father. Maliki,
                  Shafi'i and Hanbali (Zayd ibn Thabit's view) — siblings share alongside him by the
                  muqasama computation. Choose under §04 School &amp; options.
                </p>
              </>
            }
          />
          <ToggleField
            label="Maternal grandmother" arabic="الجدة لأم" value={family.maternalGrandmother}
            onChange={(v) => onChange({ maternalGrandmother: v })}
            blocked={b("maternalGrandmother")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅙ shared</p>
                <p className="mt-1">
                  The mother's mother takes ⅙ when the mother is absent (Abu Dawud 2894; Tirmidhi
                  2100). If a paternal grandmother also inherits, the two share the single ⅙.
                </p>
              </>
            }
          />
          <ToggleField
            label="Paternal grandmother" arabic="الجدة لأب" value={family.paternalGrandmother}
            onChange={(v) => onChange({ paternalGrandmother: v })}
            blocked={b("paternalGrandmother")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅙ shared</p>
                <p className="mt-1">
                  The father's mother takes ⅙ when both the father and the mother are absent. The
                  schools differ on edge cases (e.g. grandmother through a living father) — see the
                  documentation, §5.
                </p>
              </>
            }
          />

          <h3 className="mb-1 mt-5 border-b border-ink/15 pb-1 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">
            Children &amp; grandchildren
          </h3>
          <CountField
            label="Sons" arabic="الأبناء" value={family.sons}
            onChange={(v) => onChange({ sons: v })}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary, 2 : 1</p>
                <p className="mt-1">
                  Quran 4:11 — 'for the male, the share of two females.' Sons take all residue after
                  the fixed shares; daughters inheriting beside them count at half a son each. A son
                  excludes grandchildren, siblings, nephews and uncles.
                </p>
              </>
            }
          />
          <CountField
            label="Daughters" arabic="البنات" value={family.daughters}
            onChange={(v) => onChange({ daughters: v })}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">½ or ⅔ — or residuary with sons</p>
                <p className="mt-1">
                  Quran 4:11 — one daughter alone takes ½; two or more share ⅔. With a son they join
                  him as residuaries at the 2:1 ratio instead. Daughters never get fully excluded.
                </p>
              </>
            }
          />
          <CountField
            label="Son's sons" arabic="أبناء الابن" value={family.sonsSons}
            onChange={(v) => onChange({ sonsSons: v })}
            blocked={b("sonsSons")}
            hint="Grandsons through sons only — daughters' children are non-heir kin (see docs §5 on dhawu'l-arham)."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary in the son's absence</p>
                <p className="mt-1">
                  A son's son stands in the son's place when no son survives: same residuary power,
                  same 2:1 rule with son's daughters.
                </p>
              </>
            }
          />
          <CountField
            label="Son's daughters" arabic="بنات الابن" value={family.sonsDaughters}
            onChange={(v) => onChange({ sonsDaughters: v })}
            blocked={b("sonsDaughters")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">½, ⅔, or ⅙ completion</p>
                <p className="mt-1">
                  With no daughters: like daughters (½ for one, ⅔ for more). With exactly one
                  daughter: they 'complete' the ⅔, taking ⅙. With two or more daughters and no
                  son's son: excluded — the ⅔ is exhausted.
                </p>
              </>
            }
          />
        </div>

        {/* ---- siblings & agnates ---- */}
        <div>
          <h3 className="mb-1 border-b border-ink/15 pb-1 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">
            Siblings
          </h3>
          <CountField
            label="Full brothers" arabic="الإخوة الأشقاء" value={family.fullBrothers}
            onChange={(v) => onChange({ fullBrothers: v })}
            blocked={b("fullBrothers")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary</p>
                <p className="mt-1">
                  Full brothers take the residue after the male line (Quran 4:176 with Bukhari
                  6732). They are excluded by a son, son's son, father — and, in the Hanafi school
                  only, by the grandfather.
                </p>
              </>
            }
          />
          <CountField
            label="Full sisters" arabic="الأخوات الشقيقات" value={family.fullSisters}
            onChange={(v) => onChange({ fullSisters: v })}
            blocked={b("fullSisters")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">½, ⅔, residuary</p>
                <p className="mt-1">
                  Quran 4:176 — one full sister takes ½ in kalala (no child, no father), two or more
                  share ⅔. With a full brother they become residuaries 2:1; with daughters they take
                  the residue ('make sisters with daughters residuaries' — Musnad Ahmad).
                </p>
              </>
            }
          />
          <CountField
            label="Paternal half-brothers" arabic="الإخوة لأب" value={family.paternalBrothers}
            onChange={(v) => onChange({ paternalBrothers: v })}
            blocked={b("paternalBrothers")}
            hint="Same father, different mother. Excluded by a full brother."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary after full siblings</p>
                <p className="mt-1">
                  Consanguine brothers take the residue when no full brother exists; a full brother
                  is the stronger agnate and blocks them entirely.
                </p>
              </>
            }
          />
          <CountField
            label="Paternal half-sisters" arabic="الأخوات لأب" value={family.paternalSisters}
            onChange={(v) => onChange({ paternalSisters: v })}
            blocked={b("paternalSisters")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Like full sisters, or ⅙ completion</p>
                <p className="mt-1">
                  With no full sisters they take the sisters' shares (½ / ⅔). Beside exactly one
                  full sister they complete the ⅔ with ⅙. Beside two or more full sisters they take
                  nothing unless a consanguine brother exists.
                </p>
              </>
            }
          />
          <CountField
            label="Maternal half-brothers" arabic="الإخوة لأم" value={family.maternalBrothers}
            onChange={(v) => onChange({ maternalBrothers: v })}
            blocked={b("maternalBrothers")}
            hint="Same mother, different father (uterine)."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅙ or ⅓ — equally, male or female</p>
                <p className="mt-1">
                  Quran 4:12 — in kalala (no descendant, no father or grandfather) a single uterine
                  sibling takes ⅙; two or more share ⅓ equally, with no male preference. This is the
                  one share where gender is irrelevant.
                </p>
              </>
            }
          />
          <CountField
            label="Maternal half-sisters" arabic="الأخوات لأم" value={family.maternalSisters}
            onChange={(v) => onChange({ maternalSisters: v })}
            blocked={b("maternalSisters")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">⅙ or ⅓ shared</p>
                <p className="mt-1">
                  Same rule as uterine brothers (Quran 4:12): one takes ⅙, several share ⅓ equally.
                  In the al-Mushtaraka case the schools divide on whether full brothers join this
                  pool — see §04.
                </p>
              </>
            }
          />

          <h3 className="mb-1 mt-5 border-b border-ink/15 pb-1 font-display text-sm font-semibold uppercase tracking-[0.14em] text-leaf">
            Extended male agnates
          </h3>
          <p className="mb-1 text-xs text-ink-soft">
            Inherit only when every nearer class above them is absent (Bukhari 6732's 'closest male
            relative').
          </p>
          <CountField
            label="Full brothers' sons" value={family.fullNephews}
            onChange={(v) => onChange({ fullNephews: v })}
            blocked={b("fullNephews")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary</p>
                <p className="mt-1">
                  Nephews through full brothers inherit the residue only when no son, grandson,
                  father, grandfather, or brother survives.
                </p>
              </>
            }
          />
          <CountField
            label="Paternal half-brothers' sons" value={family.paternalNephews}
            onChange={(v) => onChange({ paternalNephews: v })}
            blocked={b("paternalNephews")}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary</p>
                <p className="mt-1">After full brothers' sons in the agnate chain.</p>
              </>
            }
          />
          <CountField
            label="Full paternal uncles" value={family.fullPaternalUncles}
            onChange={(v) => onChange({ fullPaternalUncles: v })}
            blocked={b("fullPaternalUncles")}
            hint="Father's full brothers."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary</p>
                <p className="mt-1">
                  'A paternal uncle has the standing of a father' (Musnad Ahmad) — he inherits when
                  the whole nearer chain is absent.
                </p>
              </>
            }
          />
          <CountField
            label="Paternal half-uncles" value={family.paternalUncles}
            onChange={(v) => onChange({ paternalUncles: v })}
            blocked={b("paternalUncles")}
            hint="Father's consanguine brothers — the last class this tool computes. The chain continues (their sons, then the grandfather's brothers); see documentation §8."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Residuary, last link</p>
                <p className="mt-1">
                  After them the chain would continue to their sons, then to the grandfather's
                  brothers. If your case reaches that far, treat the result here as guidance and
                  consult a scholar.
                </p>
              </>
            }
          />
        </div>
      </div>
    </SectionShell>
  );
}
