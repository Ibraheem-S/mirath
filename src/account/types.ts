/**
 * Account framework — privacy-first, local-first.
 *
 * Design principles (see docs/11-accounts-privacy.md):
 *  - Data minimization: the only personal data held is what the user types here.
 *  - No transmission: the LocalAccountStore never sends anything anywhere.
 *  - Consent: an explicit, versioned, timestamped consent is recorded before
 *    anything is persisted.
 *  - Rights by construction: access, portability (JSON export), rectification
 *    (editing), and erasure (one-click delete) are first-class operations.
 *  - Pluggable backend: AccountStore is an interface; a server implementation
 *    can replace the local one without touching the UI.
 */

import type { EstateInput, FamilyInput, RuleOptions } from "@/engine";
import type { WillMeta } from "@/will/generateWillPdf";

export const PRIVACY_POLICY_VERSION = "1.0";

export type DesigneeRole =
  | "executor"
  | "alternate-executor"
  | "bequest-beneficiary"
  | "witness-1"
  | "witness-2"
  | "guardian-minors"
  | "other";

export const DESIGNEE_ROLE_LABEL: Record<DesigneeRole, string> = {
  executor: "Executor (wasi)",
  "alternate-executor": "Alternate executor",
  "bequest-beneficiary": "Bequest beneficiary",
  "witness-1": "Witness 1",
  "witness-2": "Witness 2",
  "guardian-minors": "Guardian for minor children",
  other: "Other designee",
};

export interface Designee {
  id: string;
  role: DesigneeRole;
  name: string;
  relationship: string;
  contact: string;
}

export const emptyDesignee = (role: DesigneeRole = "other"): Designee => ({
  id: crypto.randomUUID(),
  role,
  name: "",
  relationship: "",
  contact: "",
});

/** Everything the account persists about the user's work. */
export interface SavedPlan {
  family: FamilyInput;
  estate: EstateInput;
  options: RuleOptions;
  willMeta: WillMeta;
}

export interface AccountProfile {
  id: string;
  displayName: string;
  designees: Designee[];
  consent: {
    policyVersion: string;
    acceptedAt: string; // ISO timestamp
  };
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
  plan: SavedPlan;
}

/** Storage envelope written to the device. */
export type StoreEnvelope =
  | { kind: "plain"; profile: AccountProfile }
  | { kind: "encrypted"; salt: string; iv: string; ciphertext: string };

/** The pluggable persistence contract. */
export interface AccountStore {
  /** Load the envelope, if any. Never throws on absence. */
  load(): Promise<StoreEnvelope | null>;
  /** Persist the envelope (already encrypted if applicable). */
  save(envelope: StoreEnvelope): Promise<void>;
  /** Erase everything — GDPR Art. 17 / CCPA deletion. */
  erase(): Promise<void>;
}

export interface AccountState {
  /** null = anonymous (full app usable, nothing persisted) */
  profile: AccountProfile | null;
  /** true when an encrypted envelope exists but is still locked */
  locked: boolean;
}
