import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAccount } from "./AccountContext";
import {
  DESIGNEE_ROLE_LABEL, emptyDesignee, type Designee, type DesigneeRole,
} from "./types";
import { InfoTip } from "@/components/InfoTip";
import { Download, Eye, Lock, ShieldCheck, Trash2, UserCircle2, UserPlus } from "lucide-react";

const inputCls =
  "w-full border border-ink/30 bg-paper-card px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-leaf";

export function AccountDialog() {
  const { profile, locked } = useAccount();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="no-print flex items-center gap-2 border border-ink/30 bg-paper-card px-3 py-1.5 text-sm text-ink transition-colors hover:border-leaf hover:text-leaf"
        >
          <UserCircle2 size={16} />
          <span className="max-w-[10rem] truncate">
            {profile ? profile.displayName : locked ? "Account locked" : "Account"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-ink/25 bg-paper text-ink">
        {locked ? <LockedView /> : profile ? <ProfileView /> : <CreateView />}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- create ---------- */
function CreateView() {
  const { createAccount } = useAccount();
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await createAccount(name.trim(), passphrase.length >= 8 ? passphrase : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-ink">Create a local account</DialogTitle>
        <DialogDescription className="text-ink-soft">
          Save your settings, your name, and your designees — on this device only.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-2 border border-leaf/40 bg-leaf-mist p-3.5 text-sm leading-relaxed text-ink">
        <p className="flex items-center gap-2 font-semibold text-leaf">
          <ShieldCheck size={16} /> Privacy by design
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-ink-soft">
          <li>Everything is stored <strong>only on this device</strong> (browser local storage). Nothing is transmitted, tracked, or shared — no cookies, no analytics.</li>
          <li>Optionally encrypt your data with a passphrase (PBKDF2 + AES-256-GCM via WebCrypto).</li>
          <li>You can view, export (JSON), rectify, or permanently erase your data at any time — GDPR Art. 15–20 &amp; CCPA rights, built in.</li>
          <li>Full details: <code className="text-[12px]">docs/11-accounts-privacy.md</code>. The app works fully without an account.</li>
        </ul>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-ink">Your name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina bint Yusuf" aria-label="Your name" />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
            Passphrase (optional — encrypts your data)
            <InfoTip label="About the passphrase">
              With a passphrase of 8+ characters, your profile is encrypted at rest with AES-256-GCM
              (key derived via PBKDF2, 150,000 iterations). Without it, data is stored unencrypted
              on this device. There is no recovery — a forgotten passphrase means the data can only
              be erased, not read.
            </InfoTip>
          </label>
          <input className={inputCls} type="password" value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="8+ characters, or leave empty for no encryption" aria-label="Passphrase" />
          {passphrase.length > 0 && passphrase.length < 8 && (
            <p className="mt-1 text-xs text-blood">Fewer than 8 characters — the account will be saved unencrypted.</p>
          )}
        </div>
        <label className="flex items-start gap-2.5 border border-ink/20 bg-paper-card p-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#1d4a38]" aria-label="Consent" />
          <span className="text-[13px] leading-relaxed text-ink-soft">
            I understand and consent that my name, designees, and estate-planning inputs will be
            stored <strong>on this device</strong> for the purpose of saving my work, and that I can
            view, export, correct, or erase them at any time. (Consent is recorded with a timestamp
            and policy version, GDPR Art. 7.)
          </span>
        </label>
        <button type="button" disabled={!name.trim() || !consent || busy} onClick={submit}
          className="flex items-center gap-2 border border-leaf bg-leaf px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-leaf-bright disabled:cursor-not-allowed disabled:opacity-40">
          <UserPlus size={15} /> Create local account
        </button>
      </div>
    </>
  );
}

/* ---------- locked ---------- */
function LockedView() {
  const { unlock, deleteAccount } = useAccount();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(false);
    const ok = await unlock(passphrase);
    setBusy(false);
    if (!ok) setError(true);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-2xl text-ink">
          <Lock size={20} className="text-gilt" /> Account locked
        </DialogTitle>
        <DialogDescription className="text-ink-soft">
          An encrypted account exists on this device. Enter its passphrase to unlock it.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-3 space-y-3">
        <input className={inputCls} type="password" value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Passphrase" aria-label="Unlock passphrase" autoFocus />
        {error && <p className="text-sm text-blood">Wrong passphrase — the data could not be decrypted.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!passphrase || busy} onClick={submit}
            className="border border-leaf bg-leaf px-4 py-2 text-sm font-semibold text-paper hover:bg-leaf-bright disabled:opacity-40">
            Unlock
          </button>
          <EraseButton label="Erase all account data from this device" onErase={deleteAccount} />
        </div>
      </div>
    </>
  );
}

/* ---------- active profile ---------- */
function ProfileView() {
  const { profile, renameAccount, upsertDesignee, removeDesignee, exportData, deleteAccount, lock } = useAccount();
  const [showData, setShowData] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  if (!profile) return null;

  const addDesignee = () =>
    upsertDesignee(emptyDesignee(profile.designees.length === 0 ? "executor" : "other"));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-ink">Your account</DialogTitle>
        <DialogDescription className="text-ink-soft">
          Stored on this device only · {profile.encrypted ? "encrypted (AES-256-GCM)" : "not encrypted"} ·
          consent recorded {new Date(profile.consent.acceptedAt).toLocaleString()} (policy v{profile.consent.policyVersion})
        </DialogDescription>
      </DialogHeader>

      <div className="mt-3">
        <label className="text-sm font-medium text-ink">Your name</label>
        <input className={inputCls} value={profile.displayName}
          onChange={(e) => renameAccount(e.target.value)} aria-label="Your name" />
        <p className="mt-1 text-xs text-ink-faint">Rectification (GDPR Art. 16): edits save automatically.</p>
      </div>

      {/* designees */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-leaf">Designees</h3>
          <button type="button" onClick={addDesignee}
            className="flex items-center gap-1.5 border border-leaf px-2.5 py-1 text-xs font-semibold text-leaf hover:bg-leaf hover:text-paper">
            <UserPlus size={13} /> Add designee
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">
          The people you appoint — executor, witnesses, guardian, bequest beneficiary. Executor,
          beneficiary and witnesses flow into the will PDF automatically.
        </p>
        {profile.designees.length === 0 && (
          <p className="mt-3 border border-dashed border-ink/30 p-3 text-sm text-ink-faint">
            No designees yet.
          </p>
        )}
        <div className="mt-2 space-y-3">
          {profile.designees.map((d) => (
            <DesigneeRow key={d.id} d={d} onChange={upsertDesignee} onRemove={removeDesignee} />
          ))}
        </div>
      </div>

      {/* privacy rights */}
      <div className="mt-6 border-t-2 border-ink pt-4">
        <h3 className="font-display text-base font-semibold text-leaf">Your privacy rights</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowData((s) => !s)}
            className="flex items-center gap-1.5 border border-ink/30 px-3 py-1.5 text-xs font-medium text-ink hover:border-leaf">
            <Eye size={13} /> {showData ? "Hide my data" : "View my data"} (Art. 15)
          </button>
          <button type="button" onClick={exportData}
            className="flex items-center gap-1.5 border border-ink/30 px-3 py-1.5 text-xs font-medium text-ink hover:border-leaf">
            <Download size={13} /> Export JSON (Art. 20)
          </button>
          {profile.encrypted && (
            <button type="button" onClick={lock}
              className="flex items-center gap-1.5 border border-ink/30 px-3 py-1.5 text-xs font-medium text-ink hover:border-leaf">
              <Lock size={13} /> Lock account
            </button>
          )}
          {!confirmErase ? (
            <button type="button" onClick={() => setConfirmErase(true)}
              className="flex items-center gap-1.5 border border-blood/50 px-3 py-1.5 text-xs font-medium text-blood hover:bg-blood/10">
              <Trash2 size={13} /> Erase everything (Art. 17)
            </button>
          ) : (
            <span className="flex items-center gap-2 border border-blood bg-blood/10 px-3 py-1.5 text-xs">
              <span className="font-semibold text-blood">Permanently delete all account data from this device?</span>
              <button type="button" onClick={deleteAccount}
                className="font-bold text-blood underline">Yes, erase</button>
              <button type="button" onClick={() => setConfirmErase(false)}
                className="text-ink underline">Cancel</button>
            </span>
          )}
        </div>
        {showData && (
          <pre className="mt-3 max-h-64 overflow-auto border border-ink/20 bg-paper-deep p-3 text-[11px] leading-relaxed text-ink-soft">
            {JSON.stringify(profile, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
}

function DesigneeRow({
  d, onChange, onRemove,
}: {
  d: Designee;
  onChange: (d: Designee) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border border-ink/20 bg-paper-card p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Role</label>
          <select value={d.role} onChange={(e) => onChange({ ...d, role: e.target.value as DesigneeRole })}
            className="mt-0.5 w-full border border-ink/30 bg-paper px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-leaf"
            aria-label="Designee role">
            {(Object.keys(DESIGNEE_ROLE_LABEL) as DesigneeRole[]).map((r) => (
              <option key={r} value={r}>{DESIGNEE_ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Full name</label>
          <input className={`${inputCls} mt-0.5`} value={d.name}
            onChange={(e) => onChange({ ...d, name: e.target.value })}
            placeholder="e.g. Khalid ibn Yusuf" aria-label="Designee name" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Relationship</label>
          <input className={`${inputCls} mt-0.5`} value={d.relationship}
            onChange={(e) => onChange({ ...d, relationship: e.target.value })}
            placeholder="e.g. brother, friend, attorney" aria-label="Designee relationship" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Contact (optional)</label>
          <input className={`${inputCls} mt-0.5`} value={d.contact}
            onChange={(e) => onChange({ ...d, contact: e.target.value })}
            placeholder="phone or email" aria-label="Designee contact" />
        </div>
      </div>
      <button type="button" onClick={() => onRemove(d.id)}
        className="mt-2 text-xs font-medium text-blood underline">
        Remove
      </button>
    </div>
  );
}

function EraseButton({ label, onErase }: { label: string; onErase: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <button type="button" onClick={() => setConfirm(true)}
        className="text-xs font-medium text-blood underline">
        {label}
      </button>
    );
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="font-semibold text-blood">Irreversible — erase now?</span>
      <button type="button" onClick={() => void onErase()} className="font-bold text-blood underline">Yes</button>
      <button type="button" onClick={() => setConfirm(false)} className="text-ink underline">Cancel</button>
    </span>
  );
}
