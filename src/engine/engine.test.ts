import { describe, it, expect } from "vitest";
import { calculate } from "./engine";
import { emptyFamily, type EstateInput, type FamilyInput, type RuleOptions } from "./types";

const estate: EstateInput = {
  grossEstate: 1000, funeralCosts: 0, debts: 0,
  wasiyyaAmount: 0, wasiyyaRecipientIsHeir: false, currency: "USD",
};

function fam(patch: Partial<FamilyInput>): FamilyInput {
  return { ...emptyFamily, ...patch };
}
function opts(patch: Partial<RuleOptions> = {}): RuleOptions {
  return { madhhab: "hanafi", ...patch };
}
/** find allocation by label substring */
function al(r: ReturnType<typeof calculate>, labelPart: string) {
  const a = r.allocations.find((x) => x.label.toLowerCase().includes(labelPart.toLowerCase()));
  if (!a) throw new Error(`no allocation matching ${labelPart}; got ${r.allocations.map((x) => x.label)}`);
  return a;
}
function shareEq(a: { shareTotalNum: number; shareTotalDen: number }, n: number, d: number) {
  expect(a.shareTotalNum * d).toBe(n * a.shareTotalDen);
}
function totalShares(r: ReturnType<typeof calculate>) {
  return r.allocations.reduce((acc, a) => acc + a.shareTotalNum / a.shareTotalDen, 0);
}

describe("classical faraid cases", () => {
  it("husband + 2 daughters + father → awl to 13", () => {
    const r = calculate(fam({ deceasedGender: "female", husband: true, daughters: 2, father: true }), estate, opts());
    expect(r.ok).toBe(true);
    expect(r.awlApplied).toBe(true);
    shareEq(al(r, "husband"), 3, 13);
    shareEq(al(r, "daughters"), 8, 13);
    shareEq(al(r, "father"), 2, 13);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("al-Umariyya: husband + mother + father", () => {
    const r = calculate(fam({ deceasedGender: "female", husband: true, mother: true, father: true }), estate, opts());
    expect(r.specialCases.join()).toMatch(/Umariyya/);
    shareEq(al(r, "husband"), 1, 2);
    shareEq(al(r, "mother"), 1, 6); // 1/3 of remainder
    shareEq(al(r, "father"), 1, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("al-Umariyya-2: wife + mother + father", () => {
    const r = calculate(fam({ wives: 1, mother: true, father: true }), estate, opts());
    shareEq(al(r, "wife"), 1, 4);
    shareEq(al(r, "mother"), 1, 4); // 1/3 of 3/4
    shareEq(al(r, "father"), 1, 2);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("son + daughter → 2:1 residuary", () => {
    const r = calculate(fam({ sons: 1, daughters: 1 }), estate, opts());
    const a = al(r, "sons (×1) and daughters");
    shareEq(a, 1, 1);
    expect(a.perHead).toBeTruthy();
    shareEq({ shareTotalNum: a.perHead!.maleShareNum, shareTotalDen: a.perHead!.maleShareDen }, 2, 3);
    shareEq({ shareTotalNum: a.perHead!.femaleShareNum, shareTotalDen: a.perHead!.femaleShareDen }, 1, 3);
  });

  it("mother + father only → mother 1/3, father residue", () => {
    const r = calculate(fam({ mother: true, father: true }), estate, opts());
    shareEq(al(r, "mother"), 1, 3);
    shareEq(al(r, "father"), 2, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("single full sister kalala → 1/2 then radd to all (Hanafi)", () => {
    const r = calculate(fam({ deceasedGender: "female", fullSisters: 1 }), estate, opts());
    expect(r.raddApplied).toBe(true);
    shareEq(al(r, "full sister"), 1, 1);
  });

  it("wife alone: Hanafi gives her 1/4 + treasury note; Hanbali gives radd", () => {
    const h = calculate(fam({ wives: 1 }), estate, opts({ madhhab: "hanafi" }));
    expect(h.raddApplied).toBe(false);
    shareEq(al(h, "wife"), 1, 4);
    const b = calculate(fam({ wives: 1 }), estate, opts({ madhhab: "hanbali" }));
    expect(b.raddApplied).toBe(true);
    shareEq(al(b, "wife"), 1, 1);
  });

  it("al-Mushtaraka (Shafi'i): husband, mother, 2 uterine brothers, 2 full brothers", () => {
    const r = calculate(
      fam({ deceasedGender: "female", husband: true, mother: true, maternalBrothers: 2, fullBrothers: 2 }),
      estate, opts({ madhhab: "shafii" }),
    );
    shareEq(al(r, "husband"), 1, 2);
    shareEq(al(r, "mother"), 1, 6);
    shareEq(al(r, "mushtaraka"), 1, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("al-Mushtaraka (Hanafi): full brothers get nothing", () => {
    const r = calculate(
      fam({ deceasedGender: "female", husband: true, mother: true, maternalBrothers: 2, fullBrothers: 2 }),
      estate, opts({ madhhab: "hanafi" }),
    );
    expect(r.allocations.find((a) => a.label.includes("joined"))).toBeUndefined(); // dropped (zero)
    shareEq(al(r, "maternal"), 1, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("grandfather excludes siblings (Hanafi)", () => {
    const r = calculate(fam({ paternalGrandfather: true, fullBrothers: 1, fullSisters: 1 }), estate, opts({ madhhab: "hanafi" }));
    shareEq(al(r, "grandfather"), 1, 1);
    expect(r.exclusions.some((e) => e.label.includes("Full brothers"))).toBe(true);
  });

  it("grandfather + brother + sister muqasama (Shafi'i)", () => {
    const r = calculate(fam({ paternalGrandfather: true, fullBrothers: 1, fullSisters: 1 }), estate, opts({ madhhab: "shafii" }));
    shareEq(al(r, "grandfather"), 2, 5);
    const sibs = al(r, "siblings with grandfather");
    shareEq(sibs, 3, 5);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("grandfather + 1 sister: sister keeps fard 1/2, gf takes 1/2 (Shafi'i)", () => {
    const r = calculate(fam({ deceasedGender: "female", paternalGrandfather: true, fullSisters: 1 }), estate, opts({ madhhab: "shafii" }));
    shareEq(al(r, "grandfather"), 1, 2);
    shareEq(al(r, "full sister"), 1, 2);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("grandfather + 2 sisters: sisters floored at 2/3, gf 1/3 (Shafi'i)", () => {
    const r = calculate(fam({ deceasedGender: "female", paternalGrandfather: true, fullSisters: 2 }), estate, opts({ madhhab: "shafii" }));
    shareEq(al(r, "grandfather"), 1, 3);
    shareEq(al(r, "full sisters"), 2, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("al-Akdariyya: husband, mother, grandfather, full sister (Shafi'i)", () => {
    const r = calculate(
      fam({ deceasedGender: "female", husband: true, mother: true, paternalGrandfather: true, fullSisters: 1 }),
      estate, opts({ madhhab: "shafii" }),
    );
    expect(r.awlApplied).toBe(true);
    shareEq(al(r, "husband"), 9, 27);
    shareEq(al(r, "mother"), 6, 27);
    shareEq(al(r, "grandfather"), 8, 27);
    shareEq(al(r, "full sister"), 4, 27);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("uterine siblings: 1 → 1/6, 2 → 1/3 shared equally", () => {
    const r = calculate(fam({ maternalBrothers: 1, maternalSisters: 1, fullBrothers: 1 }), estate, opts());
    shareEq(al(r, "maternal"), 1, 3);
    shareEq(al(r, "full brother"), 2, 3);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("mother reduced to 1/6 by 2+ siblings who are themselves excluded", () => {
    const r = calculate(fam({ mother: true, father: true, fullBrothers: 2 }), estate, opts());
    shareEq(al(r, "mother"), 1, 6);
    shareEq(al(r, "father"), 5, 6);
  });

  it("daughter + son's daughter: takmila 1/6, then radd scales both", () => {
    const r = calculate(fam({ daughters: 1, sonsDaughters: 1 }), estate, opts());
    expect(r.raddApplied).toBe(true); // 1/2 + 1/6 = 2/3, surplus returns proportionally
    shareEq(al(r, "daughter"), 3, 4);
    shareEq(al(r, "son's daughter"), 1, 4);
    expect(totalShares(r)).toBeCloseTo(1, 9);
  });

  it("2 daughters exclude son's daughters when no son's son", () => {
    const r = calculate(fam({ daughters: 2, sonsDaughters: 1, father: true }), estate, opts());
    expect(r.exclusions.some((e) => e.label === "Son's daughters")).toBe(true);
    shareEq(al(r, "daughters"), 2, 3);
  });

  it("estate pipeline: debts and 1/3 wasiyya cap before distribution", () => {
    const e: EstateInput = { grossEstate: 900, funeralCosts: 100, debts: 200, wasiyyaAmount: 400, wasiyyaRecipientIsHeir: false, currency: "USD" };
    const r = calculate(fam({ sons: 1 }), e, opts());
    expect(r.pipeline!.wasiyyaApplied).toBeCloseTo(200, 6); // capped at 1/3 of 600
    expect(r.pipeline!.netMirath).toBeCloseTo(400, 6);
    expect(r.messages.some((m) => m.code === "WASIYYA_OVER_THIRD")).toBe(true);
  });

  it("insolvent estate is an error", () => {
    const e: EstateInput = { grossEstate: 100, funeralCosts: 50, debts: 100, wasiyyaAmount: 0, wasiyyaRecipientIsHeir: false, currency: "USD" };
    const r = calculate(fam({ sons: 1 }), e, opts());
    expect(r.ok).toBe(false);
    expect(r.messages.some((m) => m.code === "INSOLVENT_ESTATE")).toBe(true);
  });

  it("more than 4 wives is an error; husband-of-male is an error", () => {
    const r = calculate(fam({ wives: 5 }), estate, opts());
    expect(r.ok).toBe(false);
    expect(r.messages.some((m) => m.code === "TOO_MANY_WIVES")).toBe(true);
    const r2 = calculate(fam({ deceasedGender: "male", husband: true }), estate, opts());
    expect(r2.messages.some((m) => m.code === "HUSBAND_OF_MALE")).toBe(true);
  });

  it("bequest to an heir triggers the la-wasiyyata-li-warith warning", () => {
    const e: EstateInput = { grossEstate: 300, funeralCosts: 0, debts: 0, wasiyyaAmount: 50, wasiyyaRecipientIsHeir: true, currency: "USD" };
    const r = calculate(fam({ sons: 1 }), e, opts());
    expect(r.messages.some((m) => m.code === "WASIYYA_TO_HEIR")).toBe(true);
  });

  it("wives share one pool equally; 1/8 with children", () => {
    const r = calculate(fam({ wives: 3, sons: 1 }), estate, opts());
    const w = al(r, "wives");
    shareEq(w, 1, 8);
    shareEq({ shareTotalNum: w.shareEachNum, shareTotalDen: w.shareEachDen }, 1, 24);
    shareEq(al(r, "son"), 7, 8);
  });
});
