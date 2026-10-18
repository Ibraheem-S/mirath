/**
 * Local persistence for the account framework.
 * Everything stays in the browser's localStorage on the user's own device —
 * no cookies, no analytics, no network calls. Optional passphrase-based
 * encryption at rest via WebCrypto (PBKDF2 → AES-GCM).
 */
import type { AccountProfile, AccountStore, StoreEnvelope } from "./types";

const STORAGE_KEY = "mirath.account.v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptProfile(
  profile: AccountProfile,
  passphrase: string,
): Promise<StoreEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(profile)),
  );
  return {
    kind: "encrypted",
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };
}

export async function decryptProfile(
  envelope: Extract<StoreEnvelope, { kind: "encrypted" }>,
  passphrase: string,
): Promise<AccountProfile> {
  const key = await deriveKey(passphrase, fromB64(envelope.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv) as BufferSource },
    key,
    fromB64(envelope.ciphertext) as BufferSource,
  );
  return JSON.parse(dec.decode(plain)) as AccountProfile;
}

/** Device-local store. The reference implementation of AccountStore. */
export class LocalAccountStore implements AccountStore {
  async load(): Promise<StoreEnvelope | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoreEnvelope;
      if (parsed.kind !== "plain" && parsed.kind !== "encrypted") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async save(envelope: StoreEnvelope): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }

  async erase(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}
