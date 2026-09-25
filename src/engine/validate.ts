import type { EstateInput, FamilyInput, RuleOptions, ValidationMessage, Madhhab } from "./types";

/** Default per-difference rulings for each school. */
export function resolveRules(options: RuleOptions) {
  const m: Madhhab = options.madhhab;
  return {
    madhhab: m,
    grandfatherWithSiblings:
      options.grandfatherWithSiblings ?? (m === "hanafi" ? "exclude" : "share"),
    mushtaraka: options.mushtaraka ?? (m === "hanafi" ? "exclude" : "share"),
    spouseRadd: options.spouseRadd ?? (m === "hanafi" ? "no" : "yes"),
    dhawuArham:
      options.dhawuArham ?? (m === "maliki" || m === "shafii" ? "treasury" : "inherit"),
  } as const;
}

const COUNTS: (keyof FamilyInput)[] = [
  "wives",
  "sons",
  "daughters",
  "sonsSons",
  "sonsDaughters",
  "fullBrothers",
  "fullSisters",
  "paternalBrothers",
  "paternalSisters",
  "maternalBrothers",
  "maternalSisters",
  "fullNephews",
  "paternalNephews",
  "fullPaternalUncles",
  "paternalUncles",
];

/**
 * Logical-consistency validation. Runs before any arithmetic; every message
 * explains WHY the selection is impossible or legally consequential and tells
 * the user what to change.
 */
export function validate(
  family: FamilyInput,
  estate: EstateInput,
  rules: RuleOptions,
): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const rules_ = resolveRules(rules);

  // ---- structural integrity -------------------------------------------------
  for (const key of COUNTS) {
    const v = family[key] as number;
    if (!Number.isInteger(v) || v < 0) {
      msgs.push({
        severity: "error",
        code: "BAD_COUNT",
        message: `"${key}" must be a whole number of 0 or more (received ${v}).`,
        suggestion: "Enter a non-negative whole number.",
      });
    }
  }

  if (family.deceasedGender === "male" && family.husband) {
    msgs.push({
      severity: "error",
      code: "HUSBAND_OF_MALE",
      message:
        "A male deceased cannot leave a husband. The 'husband' heir applies only when the deceased is a wife.",
      suggestion: "Switch 'husband' off, or set the deceased's gender to female.",
    });
  }
  if (family.deceasedGender === "female" && family.wives > 0) {
    msgs.push({
      severity: "error",
      code: "WIVES_OF_FEMALE",
      message: "A female deceased cannot leave wives.",
      suggestion: "Set the number of wives to 0, or set the deceased's gender to male.",
    });
  }
  if (family.wives > 4) {
    msgs.push({
      severity: "error",
      code: "TOO_MANY_WIVES",
      message: `You entered ${family.wives} surviving wives. Islamic law permits a man at most four simultaneous wives (Quran 4:3), so a valid estate can never have more than four widows sharing the wife's share.`,
      suggestion: "Reduce the number of wives to 4 or fewer.",
    });
  }
  if (family.deceasedGender === "male" && family.wives === 0 && !family.husband) {
    msgs.push({
      severity: "info",
      code: "NO_SPOUSE",
      message: "No surviving spouse was entered; the spouse's share will not apply.",
    });
  }

  // ---- estate arithmetic ----------------------------------------------------
  const money = (k: keyof EstateInput) => estate[k] as number;
  for (const k of ["grossEstate", "funeralCosts", "debts", "wasiyyaAmount"] as const) {
    if (typeof money(k) !== "number" || !isFinite(money(k)) || money(k) < 0) {
      msgs.push({
        severity: "error",
        code: "BAD_MONEY",
        message: `"${k}" must be a finite number of 0 or more.`,
        suggestion: "Enter a valid non-negative amount.",
      });
    }
  }

  const afterObligations = estate.grossEstate - estate.funeralCosts - estate.debts;
  if (estate.grossEstate <= 0) {
    msgs.push({
      severity: "error",
      code: "EMPTY_ESTATE",
      message: "The gross estate is zero — there is nothing to distribute.",
      suggestion: "Enter the total value of the deceased's assets.",
    });
  } else if (afterObligations < 0) {
    msgs.push({
      severity: "error",
      code: "INSOLVENT_ESTATE",
      message: `Funeral costs (${estate.funeralCosts}) plus debts (${estate.debts}) exceed the gross estate (${estate.grossEstate}). The estate is insolvent: debts must be settled first (Quran 4:11 — "after any bequest or debt"), and creditors share pro-rata. No inheritance or bequest can be paid.`,
      suggestion: "Reduce debts/funeral costs or increase the gross estate.",
    });
  } else if (afterObligations === 0 && estate.wasiyyaAmount > 0) {
    msgs.push({
      severity: "error",
      code: "WASIYYA_FROM_NOTHING",
      message:
        "Debts and funeral costs consume the entire estate, so no bequest (wasiyya) can be paid — bequests only come out of what remains after debts.",
      suggestion: "Set the bequest to 0.",
    });
  }

  if (afterObligations > 0) {
    const cap = afterObligations / 3;
    if (estate.wasiyyaAmount > cap + 1e-9) {
      msgs.push({
        severity: "warning",
        code: "WASIYYA_OVER_THIRD",
        message: `The bequest (${estate.wasiyyaAmount}) exceeds one third of the estate after debts (${cap.toFixed(2)}). The Prophet ﷺ limited bequests to one third — "a third, and a third is much" (Sahih Muslim 1628). Any excess is invalid unless every adult heir voluntarily consents after death.`,
        suggestion: `Reduce the bequest to at most ${cap.toFixed(2)}, or note that the excess requires unanimous heir consent.`,
      });
    }
    if (estate.wasiyyaRecipientIsHeir && estate.wasiyyaAmount > 0) {
      msgs.push({
        severity: "warning",
        code: "WASIYYA_TO_HEIR",
        message:
          "The bequest is directed to a legal heir. The Prophet ﷺ said: 'Allah has given everyone their due right — so there is no bequest for an heir' (Jami' at-Tirmidhi 2120; Abu Dawud 2870). Such a bequest takes effect only if all adult heirs consent after the death (per the Hanafi school the consent must come after death; earlier consent does not count).",
        suggestion:
          "Redirect the bequest to a non-heir (charity, friend, distant relative who does not inherit), or flag it as 'heirs consented'.",
      });
    }
  }

  // ---- heir-consistency hints (not hard errors — the engine handles them) ----
  const anyHeir =
    family.husband ||
    family.wives > 0 ||
    family.father ||
    family.mother ||
    family.paternalGrandfather ||
    family.maternalGrandmother ||
    family.paternalGrandmother ||
    COUNTS.slice(1).some((k) => (family[k] as number) > 0);
  if (!anyHeir) {
    msgs.push({
      severity: "error",
      code: "NO_HEIRS",
      message:
        "No heirs were entered. In Islamic law an estate never floats: if truly no Quranic or agnate heir exists, the Hanafi and Hanbali schools pass it to distant uterine kin (dhawu'l-arham), while the Maliki and Shafi'i schools assign it to the public treasury (bayt al-mal) — and failing that, it is given in charity.",
      suggestion: "Enter at least one surviving relative, or review the 'no heirs' guidance in the documentation.",
    });
  }

  if (family.mother && (family.maternalGrandmother || family.paternalGrandmother)) {
    msgs.push({
      severity: "info",
      code: "GM_BLOCKED_BY_MOTHER",
      message:
        "A living mother excludes all grandmothers (hajb): 'the mother is nearer'. Grandmothers you entered will be shown as excluded rather than inheriting.",
    });
  }
  if (family.father && family.paternalGrandfather) {
    msgs.push({
      severity: "info",
      code: "GF_BLOCKED_BY_FATHER",
      message:
        "A living father excludes the grandfather by consensus — the grandfather only inherits in the father's absence.",
    });
  }
  if (family.sons > 0 && (family.sonsSons > 0 || family.sonsDaughters > 0)) {
    msgs.push({
      severity: "info",
      code: "GRANDCHILDREN_BLOCKED",
      message:
        "A surviving son excludes all grandchildren through sons — they only inherit when no son survives.",
    });
  }
  if (
    (family.sons > 0 || family.father || (family.sonsSons > 0 && family.sons === 0)) &&
    (family.fullBrothers > 0 ||
      family.fullSisters > 0 ||
      family.paternalBrothers > 0 ||
      family.paternalSisters > 0)
  ) {
    msgs.push({
      severity: "info",
      code: "SIBLINGS_BLOCKED",
      message:
        "A son, son's son, or father excludes all full and paternal half-siblings from the estate (hajb al-hirman).",
    });
  }
  if (family.paternalGrandfather && !family.father && rules_.grandfatherWithSiblings === "exclude" &&
      (family.fullBrothers > 0 || family.fullSisters > 0 || family.paternalBrothers > 0 || family.paternalSisters > 0)) {
    msgs.push({
      severity: "info",
      code: "GF_EXCLUDES_SIBLINGS",
      message:
        "Under the Hanafi rule (following Abu Bakr al-Siddiq), the grandfather excludes all siblings, exactly as the father would. Switch the 'Grandfather with siblings' option to see the Maliki/Shafi'i/Hanbali position, where siblings share alongside him.",
    });
  }

  return msgs;
}
