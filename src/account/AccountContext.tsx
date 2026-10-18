import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import type { AccountProfile, Designee, SavedPlan, StoreEnvelope } from "./types";
import { PRIVACY_POLICY_VERSION } from "./types";
import { LocalAccountStore, decryptProfile, encryptProfile } from "./store";

interface AccountApi {
  profile: AccountProfile | null;
  locked: boolean;
  hydrated: boolean;
  /** create a new local account from the current plan; requires explicit consent */
  createAccount: (displayName: string, passphrase: string | null) => Promise<void>;
  /** unlock an encrypted account */
  unlock: (passphrase: string) => Promise<boolean>;
  /** forget the decrypted profile (encrypted accounts only); data stays on device */
  lock: () => void;
  renameAccount: (displayName: string) => void;
  upsertDesignee: (d: Designee) => void;
  removeDesignee: (id: string) => void;
  /** GDPR Art. 20 — machine-readable export of everything stored */
  exportData: () => void;
  /** GDPR Art. 17 — erase everything from the device */
  deleteAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountApi | null>(null);

export function useAccount(): AccountApi {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount outside AccountProvider");
  return ctx;
}

export function AccountProvider({
  plan,
  onRestore,
  children,
}: {
  /** current app state, mirrored into the profile when one is active */
  plan: SavedPlan;
  /** called once when a profile is loaded/unlocked so the app can restore state */
  onRestore: (p: SavedPlan, designees: Designee[], displayName: string) => void;
  children: ReactNode;
}) {
  const store = useMemo(() => new LocalAccountStore(), []);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [locked, setLocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const passphraseRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  // hydrate from device on mount
  useEffect(() => {
    void (async () => {
      const envelope = await store.load();
      if (!envelope) {
        setHydrated(true);
        return;
      }
      if (envelope.kind === "plain") {
        setProfile(envelope.profile);
        if (!restoredRef.current) {
          restoredRef.current = true;
          onRestore(envelope.profile.plan, envelope.profile.designees, envelope.profile.displayName);
        }
      } else {
        setLocked(true);
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    async (p: AccountProfile) => {
      const stamped = { ...p, updatedAt: new Date().toISOString() };
      let envelope: StoreEnvelope;
      if (stamped.encrypted && passphraseRef.current) {
        envelope = await encryptProfile(stamped, passphraseRef.current);
      } else if (stamped.encrypted) {
        // encrypted but no passphrase in memory — keep device copy untouched
        return;
      } else {
        envelope = { kind: "plain", profile: stamped };
      }
      await store.save(envelope);
      setProfile(stamped);
    },
    [store],
  );

  // mirror plan changes into the active profile (debounced)
  const planJson = JSON.stringify(plan);
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(() => {
      void persist({ ...profile, plan: JSON.parse(planJson) as SavedPlan });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planJson]);

  const createAccount = useCallback(
    async (displayName: string, passphrase: string | null) => {
      const now = new Date().toISOString();
      const p: AccountProfile = {
        id: crypto.randomUUID(),
        displayName,
        designees: [],
        consent: { policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: now },
        encrypted: passphrase !== null,
        createdAt: now,
        updatedAt: now,
        plan: JSON.parse(planJson) as SavedPlan,
      };
      passphraseRef.current = passphrase;
      await persist(p);
    },
    [persist, planJson],
  );

  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
      const envelope = await store.load();
      if (!envelope || envelope.kind !== "encrypted") return false;
      try {
        const p = await decryptProfile(envelope, passphrase);
        passphraseRef.current = passphrase;
        setProfile(p);
        setLocked(false);
        if (!restoredRef.current) {
          restoredRef.current = true;
          onRestore(p.plan, p.designees, p.displayName);
        }
        return true;
      } catch {
        return false;
      }
    },
    [store, onRestore],
  );

  const lock = useCallback(() => {
    passphraseRef.current = null;
    setProfile(null);
    setLocked(true);
  }, []);

  const renameAccount = useCallback(
    (displayName: string) => {
      if (profile) void persist({ ...profile, displayName });
    },
    [profile, persist],
  );

  const upsertDesignee = useCallback(
    (d: Designee) => {
      if (!profile) return;
      const idx = profile.designees.findIndex((x) => x.id === d.id);
      const designees =
        idx >= 0
          ? profile.designees.map((x) => (x.id === d.id ? d : x))
          : [...profile.designees, d];
      void persist({ ...profile, designees });
    },
    [profile, persist],
  );

  const removeDesignee = useCallback(
    (id: string) => {
      if (!profile) return;
      void persist({ ...profile, designees: profile.designees.filter((d) => d.id !== id) });
    },
    [profile, persist],
  );

  const exportData = useCallback(() => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mirath-account-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile]);

  const deleteAccount = useCallback(async () => {
    passphraseRef.current = null;
    await store.erase();
    setProfile(null);
    setLocked(false);
  }, [store]);

  const api: AccountApi = {
    profile, locked, hydrated,
    createAccount, unlock, lock, renameAccount,
    upsertDesignee, removeDesignee, exportData, deleteAccount,
  };
  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}
