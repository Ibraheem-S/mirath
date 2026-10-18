/**
 * Round-trip tests for the account store's encryption envelope.
 * WebCrypto (crypto.subtle, randomUUID, getRandomValues) and atob/btoa are
 * available in the Node 20+ test runtime, so no browser is needed.
 */
import { describe, expect, it } from "vitest";
import { decryptProfile, encryptProfile } from "./store";
import type { AccountProfile } from "./types";

const profile: AccountProfile = {
  id: "test-id",
  displayName: "Amina bint Yusuf",
  designees: [
    { id: "d1", role: "executor", name: "Khalid ibn Yusuf", relationship: "brother", contact: "" },
  ],
  consent: { policyVersion: "1.0", acceptedAt: "2026-10-18T00:00:00.000Z" },
  encrypted: true,
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
  plan: {
    family: { deceasedGender: "female", husband: true } as never,
    estate: { grossEstate: 100000 } as never,
    options: { madhhab: "hanafi" },
    willMeta: { testatorName: "Amina bint Yusuf" } as never,
  },
};

describe("account encryption envelope", () => {
  it("round-trips a profile through AES-GCM with the right passphrase", async () => {
    const env = await encryptProfile(profile, "correct horse battery");
    expect(env.kind).toBe("encrypted");
    if (env.kind !== "encrypted") return;
    expect(env.ciphertext).not.toContain("Amina");
    expect(env.salt.length).toBeGreaterThan(0);
    expect(env.iv.length).toBeGreaterThan(0);
    const back = await decryptProfile(env, "correct horse battery");
    expect(back).toEqual(profile);
  });

  it("fails cleanly with a wrong passphrase (GCM auth tag)", async () => {
    const env = await encryptProfile(profile, "right passphrase");
    if (env.kind !== "encrypted") throw new Error("expected encrypted envelope");
    await expect(decryptProfile(env, "wrong passphrase")).rejects.toThrow();
  });

  it("never leaks the display name into the stored ciphertext", async () => {
    const env = await encryptProfile(profile, "passphrase-123");
    if (env.kind !== "encrypted") throw new Error("expected encrypted envelope");
    const serialized = JSON.stringify(env);
    expect(serialized).not.toContain("Amina");
    expect(serialized).not.toContain("Khalid");
    expect(serialized).not.toContain("100000");
  });
});
