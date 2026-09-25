import type { FamilyInput } from "@/engine";
import { SectionShell } from "@/components/SectionShell";
import { CountField, ToggleField } from "@/components/Field";

export function DeceasedSection({
  family,
  onChange,
}: {
  family: FamilyInput;
  onChange: (patch: Partial<FamilyInput>) => void;
}) {
  const male = family.deceasedGender === "male";
  return (
    <SectionShell
      id="deceased"
      no="01"
      title="The Deceased"
      arabic="المتوفَّى"
      lede="The estate owner. Gender determines which spouse share applies — a husband's ½/¼ (Quran 4:12) versus a wife's ¼/⅛."
    >
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[15px] font-medium text-ink">The deceased is</span>
            <div className="flex border border-ink/30">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    onChange(
                      g === "male"
                        ? { deceasedGender: g, husband: false }
                        : { deceasedGender: g, wives: 0 },
                    )
                  }
                  className={`px-5 py-2 text-sm capitalize transition-colors ${
                    family.deceasedGender === g
                      ? "bg-leaf text-paper"
                      : "bg-paper-card text-ink hover:bg-paper-deep"
                  }`}
                >
                  {g === "male" ? "Male — leaves widows" : "Female — leaves a widower"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {male ? (
          <CountField
            label="Surviving wives"
            arabic="الزوجات"
            value={family.wives}
            max={4}
            onChange={(v) => onChange({ wives: v })}
            hint="All wives share one pool equally."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">¼ or ⅛, shared</p>
                <p className="mt-1">
                  Quran 4:12 — wives take ¼ of the estate if the deceased left no child, or ⅛ if he
                  left any child (or son's child). The pool is one share divided equally among all
                  wives. A man may have at most four wives at once (Quran 4:3) — more than four
                  widows is legally impossible and will be flagged as an error.
                </p>
              </>
            }
          />
        ) : (
          <ToggleField
            label="Surviving husband"
            arabic="الزوج"
            value={family.husband}
            onChange={(v) => onChange({ husband: v })}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">½ or ¼</p>
                <p className="mt-1">
                  Quran 4:12 — the husband takes ½ if the deceased left no descendant heir, or ¼ if
                  she left a child or a son's child. The spouse is never fully excluded and never
                  partially blocked — only reduced.
                </p>
              </>
            }
          />
        )}
      </div>
    </SectionShell>
  );
}
