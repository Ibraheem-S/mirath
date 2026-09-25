/**
 * Shared types for the Mirath faraid engine.
 */

export type Gender = "male" | "female";

/** Raw family constellation as entered by the user. Counts are integers >= 0. */
export interface FamilyInput {
  deceasedGender: Gender;
  husband: boolean;
  wives: number;

  father: boolean;
  mother: boolean;
  paternalGrandfather: boolean; // "true" grandfather (father's father and above)
  maternalGrandmother: boolean; // mother's mother
  paternalGrandmother: boolean; // father's mother

  sons: number;
  daughters: number;
  sonsSons: number; // grandsons through sons only
  sonsDaughters: number; // granddaughters through sons only

  fullBrothers: number;
  fullSisters: number;
  paternalBrothers: number; // consanguine (same father)
  paternalSisters: number;
  maternalBrothers: number; // uterine (same mother)
  maternalSisters: number;

  fullNephews: number; // sons of full brothers
  paternalNephews: number; // sons of consanguine brothers
  fullPaternalUncles: number; // father's full brothers
  paternalUncles: number; // father's consanguine brothers
}

export const emptyFamily: FamilyInput = {
  deceasedGender: "male",
  husband: false,
  wives: 0,
  father: false,
  mother: false,
  paternalGrandfather: false,
  maternalGrandmother: false,
  paternalGrandmother: false,
  sons: 0,
  daughters: 0,
  sonsSons: 0,
  sonsDaughters: 0,
  fullBrothers: 0,
  fullSisters: 0,
  paternalBrothers: 0,
  paternalSisters: 0,
  maternalBrothers: 0,
  maternalSisters: 0,
  fullNephews: 0,
  paternalNephews: 0,
  fullPaternalUncles: 0,
  paternalUncles: 0,
};

export type Madhhab = "hanafi" | "maliki" | "shafii" | "hanbali";

export interface RuleOptions {
  madhhab: Madhhab;
  /** Grandfather + siblings: Hanafi excludes siblings; the other three share. */
  grandfatherWithSiblings?: "exclude" | "share";
  /** Al-Mushtaraka: may full brothers join uterine siblings in their 1/3? */
  mushtaraka?: "share" | "exclude";
  /** May a spouse receive radd (return of surplus) when no blood heirs exist? */
  spouseRadd?: "no" | "yes";
  /** When no Quranic/agnate heirs exist at all: distant uterine kin inherit
   *  (Hanafi/Hanbali) or the estate goes to the public treasury (Maliki/Shafi'i). */
  dhawuArham?: "inherit" | "treasury";
}

export interface EstateInput {
  grossEstate: number;
  funeralCosts: number;
  debts: number;
  wasiyyaAmount: number;
  wasiyyaRecipientIsHeir: boolean;
  currency: string;
}

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationMessage {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** What the user can change to resolve it. */
  suggestion?: string;
}

export type HeirCategory =
  | "husband"
  | "wife"
  | "father"
  | "mother"
  | "grandfather"
  | "grandmother"
  | "son"
  | "daughter"
  | "sonsSon"
  | "sonsDaughter"
  | "fullBrother"
  | "fullSister"
  | "paternalBrother"
  | "paternalSister"
  | "maternalBrother"
  | "maternalSister"
  | "fullNephew"
  | "paternalNephew"
  | "fullPaternalUncle"
  | "paternalUncle";

export type AllocationKind =
  | "fard" // fixed Quranic share
  | "asaba" // residuary by male agnation
  | "asaba-maa" // residuary "with another" (sisters with daughters)
  | "fard+asaba" // father / grandfather with daughters
  | "radd" // surplus returned proportionally
  | "excluded";

export interface Allocation {
  category: HeirCategory;
  label: string;
  count: number;
  kind: AllocationKind;
  /** Total share of the estate for this category (exact). */
  shareTotalNum: number;
  shareTotalDen: number;
  /** Share per person in this category. */
  shareEachNum: number;
  shareEachDen: number;
  amountTotal: number;
  amountEach: number;
  /** Plain-language reason for the share. */
  reason: string;
  /** The underlying arithmetic, shown in tooltips. */
  math: string;
  /** Primary textual authorities (Quran / hadith / ijma). */
  evidence: string[];
  /** School-specific note, when the result depends on the chosen options. */
  madhhabNote?: string;
  /** For mixed male/female residuary pools (2:1 ratio). */
  perHead?: {
    maleCount: number;
    femaleCount: number;
    maleShareNum: number;
    maleShareDen: number;
    femaleShareNum: number;
    femaleShareDen: number;
    maleAmount: number;
    femaleAmount: number;
  };
}

export interface ExclusionNote {
  category: HeirCategory;
  label: string;
  blocker: string;
  reason: string;
}

export interface EstatePipeline {
  gross: number;
  funeral: number;
  debts: number;
  afterObligations: number;
  wasiyyaAllowedCap: number; // 1/3 of afterObligations
  wasiyyaApplied: number;
  netMirath: number; // what actually divides among heirs
  currency: string;
}

export interface AuditStep {
  title: string;
  detail: string;
}

export interface CalcResult {
  ok: boolean;
  messages: ValidationMessage[];
  exclusions: ExclusionNote[];
  allocations: Allocation[];
  pipeline: EstatePipeline | null;
  steps: AuditStep[];
  /** 'asl (base denominator), after awl if any. */
  base: number | null;
  awlApplied: boolean;
  raddApplied: boolean;
  /** Effective per-difference rules actually used. */
  appliedRules: Required<Omit<RuleOptions, "madhhab">> & { madhhab: Madhhab };
  specialCases: string[];
}
