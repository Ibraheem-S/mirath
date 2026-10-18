import { useEffect, useRef } from "react";
import type { CalcResult } from "@/engine";
import type { WillMeta } from "@/will/generateWillPdf";
import { useAccount } from "@/account/AccountContext";
import type { Designee } from "@/account/types";
import { SectionShell } from "@/components/SectionShell";
import { InfoTip } from "@/components/InfoTip";
import { FileDown } from "lucide-react";

function TextField({
  label, value, onChange, placeholder, tip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tip?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-ink/30 bg-paper-card px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-leaf"
      />
    </div>
  );
}

export function WillSection({
  result,
  meta,
  onMeta,
  onGenerate,
}: {
  result: CalcResult;
  meta: WillMeta;
  onMeta: (patch: Partial<WillMeta>) => void;
  onGenerate: (designees: Designee[]) => void;
}) {
  const ready = result.ok && result.allocations.length > 0;
  const hasBequest = (result.pipeline?.wasiyyaApplied ?? 0) > 0;

  const { profile } = useAccount();
  const designees = profile?.designees ?? [];

  // Prefill the will fields from the account (name + designees) — once, and only
  // into fields the user has not typed in yet.
  const prefilledRef = useRef<Set<string>>(new Set());
  const designeesJson = JSON.stringify(designees);
  useEffect(() => {
    const ds = JSON.parse(designeesJson) as Designee[];
    const patch: Partial<WillMeta> = {};
    const fill = (key: keyof WillMeta, value: string | undefined) => {
      if (!meta[key] && value && !prefilledRef.current.has(key)) {
        patch[key] = value;
        prefilledRef.current.add(key);
      }
    };
    fill("testatorName", profile?.displayName?.trim() || undefined);
    fill("executorName", ds.find((d) => d.role === "executor")?.name.trim() || undefined);
    fill(
      "bequestRecipient",
      ds.find((d) => d.role === "bequest-beneficiary")?.name.trim() || undefined,
    );
    if (Object.keys(patch).length > 0) onMeta(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designeesJson, profile?.displayName]);

  return (
    <SectionShell
      id="will"
      no="06"
      title="The Will Document"
      arabic="الوصية"
      lede="Turn the computation into a formal, print-ready Last Will & Testament: preamble and shahada, the order of charges, the bequest clause, the full distribution table with every share's legal basis, the juristic positions applied, executor appointment, witness blocks, and the complete calculation record as a schedule."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name of the testator"
          value={meta.testatorName}
          onChange={(v) => onMeta({ testatorName: v })}
          placeholder="e.g. Amina bint Yusuf"
        />
        <TextField
          label="City & country of residence"
          value={meta.city}
          onChange={(v) => onMeta({ city: v })}
          placeholder="e.g. Amman, Jordan"
        />
        <TextField
          label="Date of execution"
          value={meta.date}
          onChange={(v) => onMeta({ date: v })}
          placeholder="YYYY-MM-DD"
        />
        <TextField
          label="Executor of the will"
          value={meta.executorName}
          onChange={(v) => onMeta({ executorName: v })}
          placeholder="e.g. my brother Khalid"
          tip={
            <p>
              The executor (wasi) pays the funeral costs, debts and bequest — in that order — then
              distributes the residue exactly per the table. Choose someone trustworthy and willing;
              many scholars recommend also naming a scholar the executor can consult.
            </p>
          }
        />
        {hasBequest && (
          <TextField
            label="Bequest beneficiary"
            value={meta.bequestRecipient}
            onChange={(v) => onMeta({ bequestRecipient: v })}
            placeholder="e.g. the orphans' fund of …"
            tip={
              <p>
                Bequests may go only to non-heirs within the one-third limit (Bukhari 2742; Muslim
                1628). If you directed the bequest to an heir, the PDF will include the consent
                clause required by Tirmidhi 2120.
              </p>
            }
          />
        )}
      </div>

      {profile && designees.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          Blank fields above are prefilled from your account — and the witnesses, guardian, and
          beneficiary you saved as designees are written into the PDF automatically.
        </p>
      )}

      <div className="no-print mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onGenerate(designees)}
          className="flex items-center gap-2 border border-leaf bg-leaf px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-leaf-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileDown size={16} /> Download the will as PDF
        </button>
        {!ready && (
          <p className="text-sm text-blood">
            Resolve the errors in §05 first — a will cannot be drafted from an invalid estate.
          </p>
        )}
        {ready && (
          <p className="text-xs text-ink-soft">
            The document records the exact fractions as governing values; monetary figures are
            estimates based on the estate values you entered.
          </p>
        )}
      </div>
    </SectionShell>
  );
}
