/**
 * Mirath faraid engine — Sunni schools (Hanafi, Maliki, Shafi'i, Hanbali).
 *
 * Pipeline (classical order, Quran 4:11 "after any bequest or debt"):
 *   gross estate → funeral costs → debts → wasiyya (max 1/3, non-heirs)
 *   → fixed shares (ashab al-furud) → residuaries ('asaba)
 *   → awl (proportional reduction) or radd (proportional return)
 *
 * All shares are exact fractions (see fraction.ts).
 */

import {
  ZERO, frac, add, sub, mul, cmp, isZero, toNumber, fmt, fmtPct, commonBase,
} from "./fraction";
import type { Frac } from "./fraction";
import type {
  Allocation, AuditStep, CalcResult, EstateInput, ExclusionNote, FamilyInput,
  HeirCategory, RuleOptions, EstatePipeline,
} from "./types";
import { resolveRules, validate } from "./validate";

// ---------------------------------------------------------------------------

interface Slot {
  category: HeirCategory;
  label: string;
  count: number; // people sharing this slot
  share: Frac; // total for the slot
  kind: Allocation["kind"];
  reason: string;
  math: string;
  evidence: string[];
  madhhabNote?: string;
}

const Q4_11 = "Quran 4:11";
const Q4_12 = "Quran 4:12";
const Q4_176 = "Quran 4:176 (al-kalala)";
const H_FARAID = "Sahih al-Bukhari 6732 — fixed shares first, residue to the nearest male agnate";

export function calculate(
  family: FamilyInput,
  estate: EstateInput,
  options: RuleOptions,
): CalcResult {
  const rules = resolveRules(options);
  const messages = validate(family, estate, options);
  const steps: AuditStep[] = [];
  const exclusions: ExclusionNote[] = [];
  const specialCases: string[] = [];
  const hasError = messages.some((m) => m.severity === "error");

  const appliedRules = { ...rules };

  if (hasError) {
    return {
      ok: false, messages, exclusions, allocations: [], pipeline: null, steps,
      base: null, awlApplied: false, raddApplied: false, appliedRules, specialCases,
    };
  }

  // ---- estate pipeline ------------------------------------------------------
  const afterObligations = estate.grossEstate - estate.funeralCosts - estate.debts;
  const wasiyyaCap = afterObligations / 3;
  const wasiyyaApplied = Math.min(estate.wasiyyaAmount, wasiyyaCap);
  const netMirath = afterObligations - wasiyyaApplied;
  const pipeline: EstatePipeline = {
    gross: estate.grossEstate,
    funeral: estate.funeralCosts,
    debts: estate.debts,
    afterObligations,
    wasiyyaAllowedCap: wasiyyaCap,
    wasiyyaApplied,
    netMirath,
    currency: estate.currency,
  };
  steps.push({
    title: "Estate pipeline",
    detail:
      `Gross estate ${estate.grossEstate} − funeral ${estate.funeralCosts} − debts ${estate.debts}` +
      ` = ${afterObligations}. Bequest applied ${wasiyyaApplied} (cap one third = ${wasiyyaCap.toFixed(2)}).` +
      ` Net estate for heirs (mirath) = ${netMirath}. Order per Quran 4:11–12: debts and bequests precede inheritance.`,
  });

  // ---- exclusion (hajb) pass ------------------------------------------------
  const F = family;
  const note = (category: HeirCategory, label: string, blocker: string, reason: string) =>
    exclusions.push({ category, label, blocker, reason });

  const fatherActive = F.father;
  if (F.paternalGrandfather && F.father)
    note("grandfather", "Grandfather", "father",
      "Excluded by the father, by consensus (ijma'): the nearer ancestor blocks the farther one.");
  const gfActive = F.paternalGrandfather && !F.father;

  const maternalGMActive = F.maternalGrandmother && !F.mother;
  const paternalGMActive = F.paternalGrandmother && !F.mother && !F.father;
  if (F.maternalGrandmother && F.mother)
    note("grandmother", "Maternal grandmother", "mother",
      "Excluded by the mother: a grandmother never inherits while the mother lives (hajb).");
  if (F.paternalGrandmother && F.mother)
    note("grandmother", "Paternal grandmother", "mother",
      "Excluded by the mother in all four schools.");
  else if (F.paternalGrandmother && F.father && !F.mother)
    note("grandmother", "Paternal grandmother", "father",
      "Excluded by the father — she is linked to the estate through him, and he is present.");

  const sonsActive = F.sons > 0;
  if (F.sonsSons > 0 && sonsActive)
    note("sonsSon", "Son's sons", "son", "Excluded by a surviving son — they inherit only in his absence.");
  if (F.sonsDaughters > 0 && sonsActive)
    note("sonsDaughter", "Son's daughters", "son", "Excluded by a surviving son.");
  const sonsSonsActive = F.sonsSons > 0 && !sonsActive;
  // 2+ daughters exclude son's daughters from any fixed share when no son's son exists
  const sonsDaughtersBlockedByDaughters = F.daughters >= 2 && F.sonsSons === 0;
  if (F.sonsDaughters > 0 && !sonsActive && sonsDaughtersBlockedByDaughters)
    note("sonsDaughter", "Son's daughters", "two or more daughters",
      "Two or more daughters already exhaust the 2/3 Quranic portion for females, so son's daughters take nothing unless a son's son exists to make them residuaries.");
  const sonsDaughtersActive =
    F.sonsDaughters > 0 && !sonsActive && !sonsDaughtersBlockedByDaughters;

  const descendantHeir =
    sonsActive || F.daughters > 0 || sonsSonsActive || sonsDaughtersActive;

  const gfExcludesSiblings = gfActive && rules.grandfatherWithSiblings === "exclude";
  const agnateSiblingsBlocked =
    sonsActive || sonsSonsActive || fatherActive || gfExcludesSiblings;
  // NOTE: daughters do NOT exclude siblings (sisters become residuaries with them);
  // granddaughters likewise. Only male descendants, the father, and (Hanafi) the grandfather.
  const maleDescendantBlocks = sonsActive || sonsSonsActive;

  if (maleDescendantBlocks || fatherActive || gfExcludesSiblings) {
    const blocker = maleDescendantBlocks ? "son / son's son" : fatherActive ? "father" : "grandfather (Hanafi rule)";
    for (const [c, l, n] of [
      ["fullBrother", "Full brothers", F.fullBrothers],
      ["fullSister", "Full sisters", F.fullSisters],
      ["paternalBrother", "Paternal half-brothers", F.paternalBrothers],
      ["paternalSister", "Paternal half-sisters", F.paternalSisters],
    ] as [HeirCategory, string, number][]) {
      if (n > 0)
        note(c, l, blocker,
          fatherActive || maleDescendantBlocks
            ? "Excluded by hajb al-hirman: a male descendant or the father blocks all full and paternal siblings (Quran 4:11, 4:176 read together)."
            : "Under the Hanafi rule (Abu Bakr's position) the grandfather is treated exactly like the father and excludes all siblings. Choose the 'share' option for the Maliki/Shafi'i/Hanbali position (Zayd ibn Thabit's position).");
    }
  }

  const fullSibsActive = !agnateSiblingsBlocked && (F.fullBrothers > 0 || F.fullSisters > 0);
  // full brothers exclude consanguine siblings entirely
  const paternalSibsActive =
    !agnateSiblingsBlocked && F.fullBrothers === 0 && (F.paternalBrothers > 0 || F.paternalSisters > 0);
  if ((F.paternalBrothers > 0 || F.paternalSisters > 0) && !agnateSiblingsBlocked && F.fullBrothers > 0)
    note("paternalBrother", "Paternal half-siblings", "full brother",
      "A full brother is a stronger agnate and excludes consanguine (paternal half-) siblings.");

  // uterine siblings: excluded by male ancestor or any descendant heir
  const uterineBlocked = descendantHeir || fatherActive || gfActive;
  if ((F.maternalBrothers > 0 || F.maternalSisters > 0) && uterineBlocked)
    note("maternalBrother", "Maternal (uterine) siblings", "father / ancestor / descendant",
      "Uterine siblings inherit only in kalala — when the deceased leaves neither a descendant heir nor a male ancestor (father/grandfather). Quran 4:12.");
  const uterineActive = !uterineBlocked && (F.maternalBrothers + F.maternalSisters) > 0;

  // nephews / uncles (agnate chain after brothers)
  const fullNephewsActive =
    !agnateSiblingsBlocked && F.fullBrothers === 0 && F.paternalBrothers === 0 && F.fullNephews > 0;
  const paternalNephewsActive =
    !agnateSiblingsBlocked && F.fullBrothers === 0 && F.paternalBrothers === 0 &&
    F.fullNephews === 0 && F.paternalNephews > 0;
  if (F.fullNephews > 0 && !agnateSiblingsBlocked && (F.fullBrothers > 0 || F.paternalBrothers > 0))
    note("fullNephew", "Full brothers' sons", "brother", "A surviving brother excludes brothers' sons — the nearer degree blocks.");
  const unclesBlocked =
    agnateSiblingsBlocked || F.fullBrothers > 0 || F.paternalBrothers > 0 ||
    fullNephewsActive || paternalNephewsActive || F.fullNephews > 0 || F.paternalNephews > 0;
  const fullUnclesActive = !unclesBlocked && F.fullPaternalUncles > 0;
  const paternalUnclesActive = !unclesBlocked && F.fullPaternalUncles === 0 && F.paternalUncles > 0;
  if ((F.fullPaternalUncles > 0 || F.paternalUncles > 0) && unclesBlocked)
    note("fullPaternalUncle", "Paternal uncles", "nearer agnate",
      "Paternal uncles are the last residuaries in this tool's chain and are excluded by any nearer male agnate (son, father, grandfather, brother, or brother's son).");

  const totalSiblingsForMother =
    F.fullBrothers + F.fullSisters + F.paternalBrothers + F.paternalSisters +
    F.maternalBrothers + F.maternalSisters;

  if (exclusions.length)
    steps.push({
      title: "Exclusions (hajb)",
      detail: exclusions.map((e) => `${e.label} blocked by ${e.blocker}`).join("; ") + ".",
    });

  // ---- special case detection ----------------------------------------------
  const spousePresent = F.husband || F.wives > 0;
  const umariyya =
    spousePresent && fatherActive && F.mother && !descendantHeir &&
    totalSiblingsForMother === 0 && !gfActive && !F.maternalGrandmother && !F.paternalGrandmother;
  if (umariyya)
    specialCases.push(
      "Al-Umariyyatayn: spouse + mother + father only. By the ruling of Umar ibn al-Khattab (followed by all four schools) the mother receives 1/3 of the REMAINDER after the spouse — not 1/3 of the whole estate, which would leave her more than the father.");

  const mushtarakaCase =
    F.husband && F.mother && !descendantHeir && !fatherActive && !gfActive &&
    F.maternalBrothers + F.maternalSisters >= 2 && F.fullBrothers >= 1 && F.fullSisters === 0;
  if (mushtarakaCase)
    specialCases.push(
      rules.mushtaraka === "share"
        ? "Al-Mushtaraka ('the shared case'): full brothers join the uterine siblings in their 1/3, sharing equally per head — Maliki, Shafi'i and Hanbali position (Umar, Zayd). The Hanafi school gives the full brothers nothing here."
        : "Al-Mushtaraka configuration detected, but the Hanafi option is selected: the full brothers receive nothing because no residue remains after the fixed shares.");

  // ---- fixed shares ---------------------------------------------------------
  const slots: Slot[] = [];
  const put = (s: Slot) => slots.push(s);

  // spouse
  if (F.husband) {
    const share = descendantHeir ? frac(1, 4) : frac(1, 2);
    put({
      category: "husband", label: "Husband", count: 1, share, kind: "fard",
      reason: descendantHeir
        ? "The husband takes 1/4 because the deceased left a child (or son's child)."
        : "The husband takes 1/2 because the deceased left no descendant heir.",
      math: descendantHeir
        ? "Quran 4:12 — 'for you is one half of what your wives leave if they have no child; if they have a child, for you is one fourth.' A descendant exists ⇒ 1/4."
        : "Quran 4:12 — no descendant heir ⇒ 1/2.",
      evidence: [Q4_12],
    });
  }
  if (F.wives > 0) {
    const share = descendantHeir ? frac(1, 8) : frac(1, 4);
    put({
      category: "wife", label: F.wives > 1 ? `Wives (×${F.wives})` : "Wife", count: F.wives,
      share, kind: "fard",
      reason: descendantHeir
        ? "The wife (or wives jointly) take 1/8 because the deceased left a descendant heir."
        : "The wife (or wives jointly) take 1/4 because there is no descendant heir.",
      math:
        `Quran 4:12 — wives take ${descendantHeir ? "1/8 with a child, " : ""}${descendantHeir ? "" : "1/4 without a child; "}the share is a single pool divided equally among ${F.wives} wife/wives: ${fmt(share)} ÷ ${F.wives}.`,
      evidence: [Q4_12],
    });
  }

  // mother
  if (F.mother) {
    let share: Frac;
    let reason: string;
    let math: string;
    if (umariyya) {
      const spouseShare = F.husband ? frac(1, 2) : frac(1, 4);
      share = mul(frac(1, 3), sub(frac(1), spouseShare));
      reason =
        "Al-Umariyya: the mother takes 1/3 of the remainder after the spouse's share, so that she does not exceed the father (Umar's ruling, all four schools).";
      math = `1/3 × (1 − ${fmt(spouseShare)}) = ${fmt(share)}. A literal 1/3 of the whole estate would give the mother more than the father; Umar ibn al-Khattab ruled she takes a third of what remains.`;
    } else if (descendantHeir || totalSiblingsForMother >= 2) {
      share = frac(1, 6);
      reason = descendantHeir
        ? "The mother is reduced from 1/3 to 1/6 because the deceased left a descendant heir."
        : `The mother is reduced from 1/3 to 1/6 because the deceased left ${totalSiblingsForMother} siblings (two or more siblings trigger the reduction even though those siblings may themselves be excluded).`;
      math =
        "Quran 4:11 — 'for the parents, to each one of them is a sixth of what he left, if he has a child'; the same verse conditions 1/3 on the absence of a child, and 'if he has brothers, then his mother has a sixth' (4:11, per the reading of Umar and the four schools, 'brothers' means two or more siblings of any kind).";
    } else {
      share = frac(1, 3);
      reason = "The mother takes 1/3: no descendant heir and fewer than two siblings.";
      math = "Quran 4:11 — 'if he has no child and his parents inherit from him, then his mother has one third.'";
    }
    put({
      category: "mother", label: "Mother", count: 1, share, kind: "fard",
      reason, math, evidence: [Q4_11, umariyya ? "Ruling of Umar ibn al-Khattab (al-Umariyyatayn), adopted by all four schools" : Q4_11],
    });
  }

  // father
  if (fatherActive) {
    if (sonsActive || sonsSonsActive) {
      put({
        category: "father", label: "Father", count: 1, share: frac(1, 6), kind: "fard",
        reason: "With a son or son's son present, the father is capped at the fixed 1/6 — the male descendant is the residuary.",
        math: "Quran 4:11 — 'for the parents, to each one a sixth, if he has a child.' A male descendant exists ⇒ father = 1/6 only.",
        evidence: [Q4_11],
      });
    } else if (F.daughters > 0 || sonsDaughtersActive) {
      put({
        category: "father", label: "Father", count: 1, share: frac(1, 6), kind: "fard+asaba",
        reason:
          "The father takes the fixed 1/6 (because female descendants exist) AND the residue as the nearest male agnate.",
        math: "Quran 4:11 gives him 1/6 with a child; Sahih al-Bukhari 6732 then gives 'whatever remains' to the closest male relative — the father.",
        evidence: [Q4_11, H_FARAID],
      });
    } else {
      put({
        category: "father", label: "Father", count: 1, share: ZERO, kind: "asaba",
        reason: "No descendant heir: the father is the pure residuary and takes everything left after the fixed shares.",
        math: "Sahih al-Bukhari 6732 — 'give the fixed shares to those entitled; what remains goes to the closest male relative.' With no child, the father heads the 'asaba chain.",
        evidence: [H_FARAID],
      });
    }
  }

  // grandmothers
  const gmCount = (maternalGMActive ? 1 : 0) + (paternalGMActive ? 1 : 0);
  if (gmCount > 0) {
    put({
      category: "grandmother",
      label: gmCount === 2 ? "Grandmothers (maternal + paternal)" : maternalGMActive ? "Maternal grandmother" : "Paternal grandmother",
      count: gmCount, share: frac(1, 6), kind: "fard",
      reason: "A true grandmother takes 1/6 when the mother is absent; two grandmothers share the single 1/6 equally.",
      math:
        "Fixed by the Sunnah (the grandmother's 1/6 — Sunan Abi Dawud 2894, Jami' at-Tirmidhi 2100; the case of the two grandmothers sharing one sixth is the ruling reported from the Companions) and consensus of the four schools on the 1/6 quantum; the schools differ only on WHICH grandmothers qualify (see documentation §5).",
      evidence: ["Sunan Abi Dawud 2894", "Jami' at-Tirmidhi 2100"],
    });
  }

  // daughters / sons
  if (F.daughters > 0 && !sonsActive) {
    const share = F.daughters === 1 ? frac(1, 2) : frac(2, 3);
    put({
      category: "daughter", label: F.daughters === 1 ? "Daughter" : `Daughters (×${F.daughters})`,
      count: F.daughters, share, kind: "fard",
      reason: F.daughters === 1
        ? "One daughter with no son takes the fixed 1/2."
        : "Two or more daughters with no son share the fixed 2/3 equally.",
      math:
        "Quran 4:11 — 'if (the heirs are) women more than two, for them is two thirds of what he left; and if there is only one, for her is half.' The verse addresses daughters directly (Ibn Abbas, ijma').",
      evidence: [Q4_11],
    });
  }
  if (sonsActive) {
    put({
      category: "son", label: F.sons === 1 ? "Son" : `Sons (×${F.sons})`, count: F.sons,
      share: ZERO, kind: "asaba",
      reason: F.daughters > 0
        ? "Sons and daughters together are residuaries: the male receives the portion of two females."
        : "Sons are the strongest residuaries and take everything remaining after the fixed shares.",
      math:
        "Quran 4:11 — 'Allah instructs you concerning your children: for the male, what is equal to the share of two females.' Sons take the residue; each son counts as two daughters when daughters share with them.",
      evidence: [Q4_11, H_FARAID],
    });
  }

  // son's children (no sons)
  if (sonsDaughtersActive && !sonsSonsActive) {
    let share: Frac;
    let reason: string;
    if (F.daughters === 0) {
      share = F.sonsDaughters === 1 ? frac(1, 2) : frac(2, 3);
      reason = "Son's daughters take the daughters' fixed share in the absence of any daughter: 1/2 for one, 2/3 for two or more.";
    } else {
      // daughters === 1 here (2+ blocked above)
      share = frac(1, 6);
      reason = "One daughter takes 1/2; son's daughters 'complete' the female 2/3 portion, receiving the remaining 1/6 (takmila).";
    }
    put({
      category: "sonsDaughter",
      label: F.sonsDaughters === 1 ? "Son's daughter" : `Son's daughters (×${F.sonsDaughters})`,
      count: F.sonsDaughters, share, kind: "fard",
      reason,
      math: `Quran 4:11's rule for daughters extends to son's daughters when no daughter competes (ijma'); with exactly one daughter they complete the 2/3: 2/3 − 1/2 = 1/6.`,
      evidence: [Q4_11],
    });
  }
  if (sonsSonsActive) {
    put({
      category: "sonsSon", label: F.sonsSons === 1 ? "Son's son" : `Son's sons (×${F.sonsSons})`,
      count: F.sonsSons, share: ZERO, kind: "asaba",
      reason: "Son's sons stand in the sons' place as residuaries when no son survives (with son's daughters at the male-for-two-females ratio when they inherit together).",
      math: "The 'asaba order descends by degree: son, then son's son how-low-so-ever (Sahih al-Bukhari 6732).",
      evidence: [H_FARAID],
    });
  }

  // uterine siblings
  if (uterineActive) {
    const n = F.maternalBrothers + F.maternalSisters;
    const share = n === 1 ? frac(1, 6) : frac(1, 3);
    const mushtarakaJoins = mushtarakaCase && rules.mushtaraka === "share";
    put({
      category: "maternalBrother",
      label: mushtarakaJoins
        ? `Uterine siblings (×${n}) + full brothers (×${F.fullBrothers}) — al-Mushtaraka`
        : n === 1
          ? F.maternalBrothers ? "Maternal half-brother" : "Maternal half-sister"
          : `Maternal half-siblings (×${n})`,
      count: n + (mushtarakaJoins ? F.fullBrothers : 0),
      share, kind: "fard",
      reason: mushtarakaJoins
        ? "Al-Mushtaraka: in the Maliki, Shafi'i and Hanbali schools the full brothers are counted with the uterine siblings in their shared 1/3, divided equally per head (male = female), because all are linked to the deceased through the mother-side pool in this case."
        : n === 1
          ? "A single uterine sibling takes 1/6 in the absence of descendants and male ancestors (kalala)."
          : "Two or more uterine siblings share 1/3 equally, males and females alike.",
      math: mushtarakaJoins
        ? `1/3 ÷ ${n + F.fullBrothers} heads equally. Umar ibn al-Khattab ruled the full brothers join the uterine pool — the famous 'donkey case' (al-himariyya). Hanafi school: full brothers get nothing here.`
        : "Quran 4:12 — 'if a man or woman is inherited from as kalala and has a (uterine) brother or sister, for each of them is a sixth; if they are more than that, they share a third.' Uterine siblings share equally regardless of gender.",
      evidence: [Q4_12, ...(mushtarakaJoins ? ["Ruling of Umar and Zayd ibn Thabit; Maliki/Shafi'i/Hanbali schools"] : [])],
      madhhabNote: mushtarakaJoins
        ? "Hanafi dissent: full brothers receive nothing in this case (Abu Hanifa reads the verse as uterine-only)."
        : undefined,
    });
    if (mushtarakaJoins) {
      // full brothers consumed into the uterine pool; mark as such
      put({
        category: "fullBrother", label: "Full brothers (joined above)", count: F.fullBrothers,
        share: ZERO, kind: "fard",
        reason: "Joined into the uterine 1/3 pool (see al-Mushtaraka entry above).",
        math: "See al-Mushtaraka entry.",
        evidence: ["Ruling of Umar; Maliki/Shafi'i/Hanbali"],
      });
    }
  }

  // full sisters (fixed) — when not made residuary by brothers or daughters
  const fullSistersFard =
    !agnateSiblingsBlocked && F.fullSisters > 0 && F.fullBrothers === 0 &&
    !(F.daughters > 0 || sonsDaughtersActive) && !mushtarakaCase;
  const fullSistersAsabaMaaGhayr =
    !agnateSiblingsBlocked && F.fullSisters > 0 && F.fullBrothers === 0 &&
    (F.daughters > 0 || sonsDaughtersActive);
  if (fullSistersFard) {
    const share = F.fullSisters === 1 ? frac(1, 2) : frac(2, 3);
    put({
      category: "fullSister", label: F.fullSisters === 1 ? "Full sister" : `Full sisters (×${F.fullSisters})`,
      count: F.fullSisters, share, kind: "fard",
      reason: F.fullSisters === 1
        ? "One full sister takes 1/2 in kalala (no descendant, father, or brother)."
        : "Two or more full sisters share 2/3 in kalala.",
      math: "Quran 4:176 — 'if a man perishes leaving no child and has a sister, for her is half of what he left… and if they are two (sisters), for them is two thirds.'",
      evidence: [Q4_176],
    });
  }

  // consanguine sisters (fixed/takmila)
  const paternalSistersFard =
    !agnateSiblingsBlocked && F.paternalSisters > 0 && F.paternalBrothers === 0 &&
    !(F.daughters > 0 || sonsDaughtersActive);
  if (paternalSistersFard) {
    let share: Frac | null = null;
    let reason = "";
    if (F.fullSisters === 0) {
      share = F.paternalSisters === 1 ? frac(1, 2) : frac(2, 3);
      reason = "Consanguine (paternal half-) sisters take the full sisters' fixed share when no full sister exists.";
    } else if (F.fullSisters === 1 && !mushtarakaCase) {
      share = frac(1, 6);
      reason = "One full sister takes 1/2; paternal half-sisters complete the sisters' 2/3 with the remaining 1/6 (takmila).";
    } else if (F.fullSisters >= 2) {
      exclusions.push({
        category: "paternalSister", label: "Paternal half-sisters", blocker: "two or more full sisters",
        reason: "Two or more full sisters exhaust the 2/3 sister portion, so consanguine sisters take nothing (unless a consanguine brother makes them residuaries).",
      });
    }
    if (share) {
      put({
        category: "paternalSister",
        label: F.paternalSisters === 1 ? "Paternal half-sister" : `Paternal half-sisters (×${F.paternalSisters})`,
        count: F.paternalSisters, share, kind: "fard",
        reason,
        math: "Quran 4:176 applies to full sisters; consanguine sisters take their place by analogy when full sisters are absent (ijma'), or complete the 2/3 alongside a single full sister (the takmila rule, agreed by the four schools).",
        evidence: [Q4_176],
      });
    }
  }

  // ---- residue & residuaries -------------------------------------------------
  const fixedSum = () => slots.reduce((acc, s) => add(acc, s.share), ZERO);
  let residue = sub(frac(1), fixedSum());
  let awlApplied = false;
  let raddApplied = false;

  const siblingsPresentForGF =
    !agnateSiblingsBlocked &&
    (F.fullBrothers + F.fullSisters + (F.fullBrothers === 0 ? F.paternalBrothers + F.paternalSisters : 0)) > 0 &&
    !mushtarakaCase;

  // Grandfather with siblings — the Zayd ibn Thabit (muqasama) computation
  if (gfActive && rules.grandfatherWithSiblings === "share" && siblingsPresentForGF && !descendantHeir) {
    const useFull = F.fullBrothers + F.fullSisters > 0;
    const bCount = useFull ? F.fullBrothers : F.paternalBrothers;
    const sCount = useFull ? F.fullSisters : F.paternalSisters;
    const sibCat: HeirCategory = useFull ? "fullBrother" : "paternalBrother";
    const sibLabel = `${useFull ? "Full" : "Paternal half-"}siblings`;
    // slots currently hold: spouse/mother/GM fards, plus sister fards (sisters-only case)
    const sisterSlots = slots.filter((s) => s.category === "fullSister" || s.category === "paternalSister");
    const sistersFard = sisterSlots.reduce((a, s) => add(a, s.share), ZERO);
    const others = sub(fixedSum(), sistersFard); // fixed shares of non-sibling heirs
    const R = sub(frac(1), others); // pool available to grandfather + siblings

    const gfMath = (a: Frac, b: Frac, c: Frac, chosen: string, gf: Frac) =>
      `Compared: 1/6 of the estate = ${fmt(a)}; 1/3 of the residue = ${fmt(b)}; muqasama as one male among ${bCount} brother(s) and ${sCount} sister(s) = ${fmt(c)}. ⇒ ${fmt(gf)} by '${chosen}'. The Hanafi school instead excludes the siblings entirely.`;

    if (bCount > 0) {
      // sisters become residuaries with the brothers; no sister fard applies
      for (const s of sisterSlots) s.share = ZERO;
      const optA = frac(1, 6);
      const optB = mul(frac(1, 3), R);
      const optC = mul(R, frac(2, 2 + bCount * 2 + sCount));
      let gfShare = optA, scheme = "1/6 of the estate";
      if (cmp(optB, gfShare) > 0) { gfShare = optB; scheme = "1/3 of the residue"; }
      if (cmp(optC, gfShare) > 0) { gfShare = optC; scheme = "muqasama (sharing as a brother)"; }
      put({
        category: "grandfather", label: "Grandfather", count: 1, share: gfShare, kind: "fard+asaba",
        reason: `Grandfather with siblings (Zayd ibn Thabit's rule — Maliki, Shafi'i, Hanbali): he takes the best of three computations, here '${scheme}'.`,
        math: gfMath(optA, optB, optC, scheme, gfShare),
        evidence: ["Position of Zayd ibn Thabit, Uthman and Ali; Maliki/Shafi'i/Hanbali schools", H_FARAID],
        madhhabNote: "Hanafi rule (Abu Bakr's position): the grandfather excludes all siblings like a father.",
      });
      const sibPool = sub(R, gfShare);
      if (sibPool.n > 0) {
        const units = bCount * 2 + sCount;
        put({
          category: sibCat, label: `${sibLabel} with grandfather`, count: bCount + sCount,
          share: sibPool, kind: "asaba",
          reason: "Siblings take what remains of the pool after the grandfather, males receiving the portion of two females.",
          math: `Pool ${fmt(sibPool)} split 2:1 across ${bCount} brother(s) and ${sCount} sister(s) (${units} units).`,
          evidence: [Q4_176, H_FARAID],
        });
        const s = slots[slots.length - 1];
        (s as Slot & { blendedUnits?: number }).blendedUnits = units;
        (s as Slot & { sonsCount?: number }).sonsCount = bCount;
        (s as Slot & { daughtersCount?: number }).daughtersCount = sCount;
      }
    } else {
      // sisters only: sisters hold fard (1/2 or 2/3); apply the muqasama rules with the sisters' fard floor
      const totalFixed = add(others, sistersFard);
      const oneSixth = frac(1, 6);
      if (cmp(add(totalFixed, oneSixth), frac(1)) > 0) {
        // AKDARIYYA-type: awl first, then grandfather + sisters redivide their combined portions 2:1
        specialCases.push(
          "Al-Akdariyya-type case: after awl, the grandfather's and sisters' base portions are combined and redivided by muqasama (male = two females) — the famous correction reported from Umar's assembly.");
        const total = add(totalFixed, oneSixth);
        // awl every slot (incl. sisters), provisional gf = 1/6 awled
        for (const s of slots) {
          if (s.share.n > 0) s.share = frac(s.share.n * total.d, s.share.d * total.n);
        }
        const gfProv = frac(oneSixth.n * total.d, oneSixth.d * total.n);
        const sibProv = sisterSlots.reduce((a, s) => add(a, s.share), ZERO);
        const combined = add(gfProv, sibProv);
        const units = 2 + sCount;
        const gfFinal = mul(combined, frac(2, units));
        const sibFinal = sub(combined, gfFinal);
        put({
          category: "grandfather", label: "Grandfather", count: 1, share: gfFinal, kind: "fard+asaba",
          reason: "Al-Akdariyya method: shares exceeded the estate, so after awl the grandfather and sisters redivide their combined portions by muqasama.",
          math: `Awl by ${fmt(total)}; grandfather's 1/6 (${fmt(gfProv)}) + sisters' portion (${fmt(sibProv)}) = ${fmt(combined)}, redivided 2:1 ⇒ grandfather ${fmt(gfFinal)}, sisters ${fmt(sibFinal)}.`,
          evidence: ["Al-Akdariyya — ruling of Umar ibn al-Khattab; Maliki/Shafi'i/Hanbali schools", Q4_176],
          madhhabNote: "Hanafi rule: the grandfather would exclude the sisters entirely.",
        });
        for (const s of sisterSlots) {
          s.share = sibFinal;
          s.math += ` Al-Akdariyya: redivided with the grandfather — sisters jointly ${fmt(sibFinal)}.`;
        }
        awlApplied = true;
      } else {
        const optA = oneSixth;
        const optB = mul(frac(1, 3), sub(frac(1), totalFixed)); // 1/3 of residue after all fards
        const optC = mul(R, frac(2, 2 + sCount)); // muqasama over the whole pool
        // sisters' fard floor: if muqasama would leave the sisters below their fard, they keep the fard
        const sibMuqasama = sub(R, optC);
        let gfShare: Frac, scheme: string, sistersKeepFard: boolean;
        if (cmp(sibMuqasama, sistersFard) < 0) {
          sistersKeepFard = true;
          gfShare = sub(R, sistersFard);
          scheme = "residue after the sisters' fixed share (muqasama would undercut their Quranic fard)";
        } else {
          sistersKeepFard = false;
          gfShare = optA; scheme = "1/6 of the estate";
          if (cmp(optB, gfShare) > 0) { gfShare = optB; scheme = "1/3 of the residue"; }
          if (cmp(optC, gfShare) > 0) { gfShare = optC; scheme = "muqasama (sharing as a brother)"; }
        }
        put({
          category: "grandfather", label: "Grandfather", count: 1, share: gfShare, kind: "fard+asaba",
          reason: `Grandfather with sisters (Zayd ibn Thabit's rule — Maliki, Shafi'i, Hanbali): ${scheme}.`,
          math: gfMath(optA, optB, optC, scheme, gfShare) +
            (sistersKeepFard ? ` Sisters keep their fard of ${fmt(sistersFard)}.` : ` Sisters share ${fmt(sub(R, gfShare))} equally.`),
          evidence: ["Position of Zayd ibn Thabit; Maliki/Shafi'i/Hanbali schools", Q4_176],
          madhhabNote: "Hanafi rule (Abu Bakr's position): the grandfather excludes the sisters entirely.",
        });
        const sibShare = sistersKeepFard ? sistersFard : sub(R, gfShare);
        for (const s of sisterSlots) {
          s.share = sibShare;
          if (!sistersKeepFard) {
            s.kind = "asaba";
            s.math += ` With the grandfather taking ${scheme}, the sisters share the remaining ${fmt(sibShare)} equally.`;
          }
        }
      }
    }
    residue = sub(frac(1), fixedSum());
  } else {
    // grandfather as father-substitute (no siblings or Hanafi mode)
    if (gfActive) {
      if (descendantHeir) {
        put({
          category: "grandfather", label: "Grandfather", count: 1, share: frac(1, 6),
          kind: sonsActive || sonsSonsActive ? "fard" : "fard+asaba",
          reason: "The grandfather takes the father's place when the father is absent: 1/6 with descendants (plus residue when only female descendants exist).",
          math: "Quran 4:11's parental 1/6 extends to the grandfather in the father's absence by consensus; residue per Bukhari 6732.",
          evidence: [Q4_11, H_FARAID],
        });
      } else {
        put({
          category: "grandfather", label: "Grandfather", count: 1, share: ZERO, kind: "asaba",
          reason: "No descendant: the grandfather is the residuary in the father's place.",
          math: "The grandfather inherits the father's 'asaba position when the father is absent (ijma').",
          evidence: [H_FARAID],
        });
      }
    }

    // standard 'asaba chain over the residue
    const residuary = (): void => {
      residue = sub(frac(1), fixedSum());
      if (residue.n <= 0) return;
      const take = (category: HeirCategory, label: string, count: number, reason: string, math: string, evidence: string[], kind: Allocation["kind"] = "asaba") => {
        put({ category, label, count, share: residue, kind, reason, math, evidence });
        residue = ZERO;
      };

      // find existing slot to top up (father / grandfather fard+asaba)
      const topUp = (cat: HeirCategory) => {
        const s = slots.find((x) => x.category === cat && x.kind === "fard+asaba");
        if (s) {
          s.share = add(s.share, residue);
          s.math += ` Plus residue ${fmt(residue)} as nearest male agnate ⇒ total ${fmt(s.share)}.`;
          residue = ZERO;
          return true;
        }
        const pure = slots.find((x) => x.category === cat && x.kind === "asaba" && isZero(x.share));
        if (pure) {
          pure.share = residue;
          pure.math += ` Residue = ${fmt(residue)}.`;
          residue = ZERO;
          return true;
        }
        return false;
      };

      if (sonsActive) {
        const total = F.sons + F.daughters;
        const units = F.sons * 2 + F.daughters;
        if (F.daughters > 0) {
          // mutate the placeholder son slot instead of adding a second row
          const s = slots.find((x) => x.category === "son" && x.kind === "asaba" && isZero(x.share))!;
          s.label = `Sons (×${F.sons}) and daughters (×${F.daughters})`;
          s.count = total;
          s.share = residue;
          s.reason = "Sons and daughters divide the whole residue, the male receiving the share of two females.";
          s.math = `Residue ${fmt(residue)} ÷ ${units} units; each son takes 2 units, each daughter 1.`;
          s.evidence = [Q4_11, H_FARAID];
          (s as Slot & { blendedUnits?: number }).blendedUnits = units;
          (s as Slot & { sonsCount?: number }).sonsCount = F.sons;
          (s as Slot & { daughtersCount?: number }).daughtersCount = F.daughters;
          residue = ZERO;
        } else {
          topUp("son") || take("son", F.sons === 1 ? "Son" : `Sons (×${F.sons})`, F.sons,
            "Sons take the entire residue as the strongest residuaries.",
            `Residue = ${fmt(residue)}, shared equally among ${F.sons} son(s).`, [H_FARAID]);
        }
        return;
      }
      if (sonsSonsActive) {
        const units = F.sonsSons * 2 + (sonsDaughtersActive ? F.sonsDaughters : 0);
        if (sonsDaughtersActive) {
          const s = slots.find((x) => x.category === "sonsSon" && x.kind === "asaba" && isZero(x.share))!;
          s.label = `Son's sons (×${F.sonsSons}) and son's daughters (×${F.sonsDaughters})`;
          s.count = F.sonsSons + F.sonsDaughters;
          s.share = residue;
          s.reason = "Son's sons and son's daughters divide the residue at the male-for-two-females ratio.";
          s.math = `Residue ${fmt(residue)} ÷ ${units} units.`;
          s.evidence = [Q4_11, H_FARAID];
          (s as Slot & { blendedUnits?: number }).blendedUnits = units;
          (s as Slot & { sonsCount?: number }).sonsCount = F.sonsSons;
          (s as Slot & { daughtersCount?: number }).daughtersCount = F.sonsDaughters;
          residue = ZERO;
        } else {
          take("sonsSon", F.sonsSons === 1 ? "Son's son" : `Son's sons (×${F.sonsSons})`, F.sonsSons,
            "Son's sons are the residuaries in the absence of sons.",
            `Residue = ${fmt(residue)}, equally among ${F.sonsSons}.`, [H_FARAID]);
        }
        return;
      }
      if (fatherActive) {
        topUp("father");
        return;
      }
      if (gfActive) {
        // grandfather as father-substitute takes the residue ahead of siblings
        // (in the Zayd 'share' computation this branch is never reached)
        topUp("grandfather");
        return;
      }
      // sisters as residuaries with daughters ('asaba ma'a l-ghayr)
      if (fullSistersAsabaMaaGhayr) {
        take("fullSister", F.fullSisters === 1 ? "Full sister" : `Full sisters (×${F.fullSisters})`, F.fullSisters,
          "With daughters (or son's daughters) taking the fixed shares, full sisters become residuaries 'with another' ('asaba ma'a l-ghayr) — the Prophet ﷺ ruled 'make the sisters with the daughters residuaries'.",
          `Residue after daughters' shares = ${fmt(residue)}.`,
          [Q4_176, "Hadith: 'aj'alu'l-akhawat ma'a'l-banat 'asaba' — Musnad Ahmad; acted on by the four schools"]);
        return;
      }
      if (F.fullBrothers > 0 && fullSibsActive) {
        const units = F.fullBrothers * 2 + F.fullSisters;
        take("fullBrother",
          F.fullSisters > 0 ? `Full brothers (×${F.fullBrothers}) and full sisters (×${F.fullSisters})` : F.fullBrothers === 1 ? "Full brother" : `Full brothers (×${F.fullBrothers})`,
          F.fullBrothers + F.fullSisters,
          "Full siblings are the residuaries after the male line: brothers take the residue, sisters sharing at the male-for-two-females ratio.",
          `Residue ${fmt(residue)} ÷ ${units} units (brother = 2, sister = 1).`, [Q4_176, H_FARAID]);
        const s = slots[slots.length - 1];
        (s as Slot & { blendedUnits?: number }).blendedUnits = units;
        (s as Slot & { sonsCount?: number }).sonsCount = F.fullBrothers;
        (s as Slot & { daughtersCount?: number }).daughtersCount = F.fullSisters;
        return;
      }
      if (F.paternalBrothers > 0 && paternalSibsActive) {
        const units = F.paternalBrothers * 2 + F.paternalSisters;
        take("paternalBrother",
          F.paternalSisters > 0 ? `Paternal half-brothers (×${F.paternalBrothers}) and half-sisters (×${F.paternalSisters})` : F.paternalBrothers === 1 ? "Paternal half-brother" : `Paternal half-brothers (×${F.paternalBrothers})`,
          F.paternalBrothers + F.paternalSisters,
          "Consanguine brothers inherit the residue when no full brother exists.",
          `Residue ${fmt(residue)} ÷ ${units} units.`, [Q4_176, H_FARAID]);
        const s = slots[slots.length - 1];
        (s as Slot & { blendedUnits?: number }).blendedUnits = units;
        (s as Slot & { sonsCount?: number }).sonsCount = F.paternalBrothers;
        (s as Slot & { daughtersCount?: number }).daughtersCount = F.paternalSisters;
        return;
      }
      if (paternalSibsActive && F.paternalSisters > 0 && (F.daughters > 0 || sonsDaughtersActive)) {
        take("paternalSister", `Paternal half-sisters (×${F.paternalSisters})`, F.paternalSisters,
          "Consanguine sisters become residuaries with daughters when no full sister exists.",
          `Residue = ${fmt(residue)}.`, [Q4_176, H_FARAID], "asaba-maa");
        return;
      }
      if (fullNephewsActive) {
        take("fullNephew", F.fullNephews === 1 ? "Full brother's son" : `Full brothers' sons (×${F.fullNephews})`, F.fullNephews,
          "Sons of full brothers are residuaries after the brothers themselves.",
          `Residue = ${fmt(residue)}.`, [H_FARAID]);
        return;
      }
      if (paternalNephewsActive) {
        take("paternalNephew", F.paternalNephews === 1 ? "Paternal half-brother's son" : `Paternal half-brothers' sons (×${F.paternalNephews})`, F.paternalNephews,
          "Sons of consanguine brothers are residuaries after full brothers' sons.",
          `Residue = ${fmt(residue)}.`, [H_FARAID]);
        return;
      }
      if (fullUnclesActive) {
        take("fullPaternalUncle", F.fullPaternalUncles === 1 ? "Full paternal uncle" : `Full paternal uncles (×${F.fullPaternalUncles})`, F.fullPaternalUncles,
          "The father's full brothers are residuaries after the nephew class ('a paternal uncle has the standing of a father' — Musnad Ahmad).",
          `Residue = ${fmt(residue)}.`, [H_FARAID]);
        return;
      }
      if (paternalUnclesActive) {
        take("paternalUncle", F.paternalUncles === 1 ? "Paternal half-uncle" : `Paternal half-uncles (×${F.paternalUncles})`, F.paternalUncles,
          "The father's consanguine brothers are the last residuaries in this chain.",
          `Residue = ${fmt(residue)}.`, [H_FARAID]);
        return;
      }
    };
    residuary();
  }

  // ---- awl / radd -----------------------------------------------------------
  residue = sub(frac(1), fixedSum());
  if (residue.n < 0) {
    // AWL: shares exceed the estate — reduce every share proportionally
    awlApplied = true;
    const total = fixedSum();
    steps.push({
      title: "'Awl (proportional reduction)",
      detail: `Fixed shares sum to ${fmt(total)} — more than the whole estate. By the ruling of Umar ibn al-Khattab (consensus of the four Sunni schools), every share is reduced proportionally: each heir's fraction is divided by ${fmt(total)}.`,
    });
    for (const s of slots) {
      if (s.share.n > 0) s.share = frac(s.share.n * total.d, s.share.d * total.n);
    }
  } else if (residue.n > 0) {
    // RADD: surplus remains with no residuary — return it proportionally
    const spouseCats: HeirCategory[] = ["husband", "wife"];
    const pool = slots.filter(
      (s) => s.share.n > 0 && (rules.spouseRadd === "yes" || !spouseCats.includes(s.category)),
    );
    if (pool.length > 0) {
      raddApplied = true;
      const poolSum = pool.reduce((a, s) => add(a, s.share), ZERO);
      const othersSum = sub(fixedSum(), poolSum); // spouse's fixed share, if excluded
      const target = sub(frac(1), othersSum); // pool must grow to fill this
      steps.push({
        title: "Radd (return of surplus)",
        detail:
          `Fixed shares sum to ${fmt(fixedSum())}; a surplus of ${fmt(residue)} remains with no residuary to take it. It is returned proportionally to the fixed-share heirs` +
          (rules.spouseRadd === "yes"
            ? ", including the spouse (Maliki/Shafi'i/Hanbali: the spouse shares in radd when no blood heir exists)."
            : ", EXCLUDING the spouse (classical Hanafi rule: the spouse is a fixed-share heir by marriage contract, not kinship, and does not receive radd — the surplus instead passes to distant kin or the treasury)."),
      });
      // pool grows from poolSum to target: scale each share by target/poolSum
      for (const s of pool) {
        s.share = frac(s.share.n * target.n * poolSum.d, s.share.d * target.d * poolSum.n);
        s.kind = "radd";
        s.math += ` Radd: scaled by ${fmt(target)}/${fmt(poolSum)} ⇒ ${fmt(s.share)}.`;
      }
    } else {
      steps.push({
        title: "Surplus with no eligible heir",
        detail:
          `A surplus of ${fmt(residue)} remains and no blood heir exists to receive it by radd. ` +
          (rules.dhawuArham === "inherit"
            ? "Hanafi/Hanbali rule: it passes to distant uterine kin (dhawu'l-arham — e.g. daughters' children, sisters' children, maternal aunts/uncles) in their prescribed order; failing them, to the public treasury (bayt al-mal)."
            : "Maliki/Shafi'i rule: it escheats to the public treasury (bayt al-mal) for the benefit of the Muslim community; where no functioning treasury exists it is given in charity on the deceased's behalf."),
      });
    }
  }

  // ---- assemble result -------------------------------------------------------
  const baseFractions = slots.filter((s) => s.share.n > 0).map((s) => s.share);
  const { base } = baseFractions.length ? commonBase(baseFractions) : { base: null };

  if (base) {
    steps.push({
      title: `Base of the case (asl al-mas'ala): ${base}`,
      detail:
        `All shares are expressed over a common denominator of ${base}. ` +
        slots.filter((s) => s.share.n > 0)
          .map((s) => `${s.label}: ${fmt(s.share)} = ${(s.share.n * (base / s.share.d))}/${base}`)
          .join("; ") + ".",
    });
  }

  const allocations: Allocation[] = slots
    .filter((s) => s.share.n > 0 || s.kind === "asaba")
    .map((s) => {
      const blended = s as Slot & { blendedUnits?: number; sonsCount?: number; daughtersCount?: number };
      const shareEach: Frac = frac(s.share.n, s.share.d * s.count);
      let math = s.math;
      let perHead: Allocation["perHead"];
      if (s.share.n === 0) {
        math += " Nothing remains for this residuary after the fixed shares.";
      }
      if (blended.blendedUnits && blended.sonsCount !== undefined && s.share.n > 0) {
        const unit = frac(s.share.n, s.share.d * blended.blendedUnits);
        const maleEach = frac(unit.n * 2, unit.d);
        const femaleEach = unit;
        math +=
          ` Per head: each male ${fmt(maleEach)} (${fmtPct(maleEach)}), each female ${fmt(femaleEach)} (${fmtPct(femaleEach)}).`;
        perHead = {
          maleCount: blended.sonsCount,
          femaleCount: blended.daughtersCount ?? 0,
          maleShareNum: maleEach.n,
          maleShareDen: maleEach.d,
          femaleShareNum: femaleEach.n,
          femaleShareDen: femaleEach.d,
          maleAmount: toNumber(maleEach) * netMirath,
          femaleAmount: toNumber(femaleEach) * netMirath,
        };
      }
      return {
        category: s.category,
        label: s.label,
        count: s.count,
        kind: s.kind,
        shareTotalNum: s.share.n,
        shareTotalDen: s.share.d,
        shareEachNum: shareEach.n,
        shareEachDen: shareEach.d,
        amountTotal: toNumber(s.share) * netMirath,
        amountEach: toNumber(shareEach) * netMirath,
        reason: s.reason,
        math,
        evidence: s.evidence,
        madhhabNote: s.madhhabNote,
        perHead,
      };
    });

  steps.unshift({
    title: "School rules applied",
    detail:
      `Madhhab baseline: ${rules.madhhab.toUpperCase()}. ` +
      `Grandfather+siblings: ${rules.grandfatherWithSiblings === "exclude" ? "grandfather excludes siblings (Hanafi/Abu Bakr)" : "siblings share with grandfather (Zayd's rule — Maliki/Shafi'i/Hanbali)"}. ` +
      `Al-Mushtaraka: ${rules.mushtaraka === "share" ? "full brothers join the uterine 1/3 (Maliki/Shafi'i/Hanbali)" : "full brothers excluded (Hanafi)"}. ` +
      `Spouse in radd: ${rules.spouseRadd === "yes" ? "yes (Maliki/Shafi'i/Hanbali)" : "no (classical Hanafi)"}. ` +
      `No-heir surplus: ${rules.dhawuArham === "inherit" ? "distant uterine kin (Hanafi/Hanbali)" : "public treasury (Maliki/Shafi'i)"}.`,
  });

  return {
    ok: true,
    messages,
    exclusions,
    allocations,
    pipeline,
    steps,
    base,
    awlApplied,
    raddApplied,
    appliedRules,
    specialCases,
  };
}
