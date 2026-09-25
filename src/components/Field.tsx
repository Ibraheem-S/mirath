import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { InfoTip } from "./InfoTip";

interface BaseProps {
  label: string;
  arabic?: string;
  tip?: ReactNode;
  hint?: string;
  blocked?: string | null; // if set, show as excluded with this blocker
}

/** Row shell: label + tooltip on the left, control on the right. */
function Row({ label, arabic, tip, hint, blocked, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 ${blocked ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-medium text-ink">{label}</span>
          {arabic && <span className="arabic text-[15px] text-leaf">{arabic}</span>}
          {tip && <InfoTip label={`About ${label}`}>{tip}</InfoTip>}
        </div>
        {blocked ? (
          <p className="mt-0.5 text-xs text-blood">
            Excluded — blocked by {blocked}.
          </p>
        ) : hint ? (
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

/** Integer stepper for people counts. */
export function CountField(
  props: BaseProps & {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
  },
) {
  const { value, onChange, min = 0, max = 99 } = props;
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <Row {...props}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`decrease ${props.label}`}
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center border border-ink/30 bg-paper-card text-ink transition-colors hover:bg-paper-deep disabled:opacity-30"
        >
          <Minus size={13} />
        </button>
        <span className="num w-8 text-center font-display text-lg">{value}</span>
        <button
          type="button"
          aria-label={`increase ${props.label}`}
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center border border-ink/30 bg-paper-card text-ink transition-colors hover:bg-paper-deep disabled:opacity-30"
        >
          <Plus size={13} />
        </button>
      </div>
    </Row>
  );
}

/** Yes/no toggle for a single relative. */
export function ToggleField(
  props: BaseProps & { value: boolean; onChange: (v: boolean) => void },
) {
  return (
    <Row {...props}>
      <button
        type="button"
        role="switch"
        aria-checked={props.value}
        aria-label={props.label}
        onClick={() => props.onChange(!props.value)}
        className={`relative h-7 w-12 border transition-colors ${
          props.value ? "border-leaf bg-leaf" : "border-ink/30 bg-paper-deep"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 bg-paper transition-all ${
            props.value ? "left-[1.35rem]" : "left-0.5"
          }`}
        />
      </button>
    </Row>
  );
}

/** Money input. */
export function MoneyField(
  props: BaseProps & {
    value: number;
    onChange: (v: number) => void;
    currency: string;
  },
) {
  return (
    <Row {...props}>
      <div className="flex items-center border border-ink/30 bg-paper-card focus-within:ring-2 focus-within:ring-leaf">
        <span className="border-r border-ink/20 px-2 text-xs text-ink-soft">{props.currency}</span>
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          aria-label={props.label}
          value={Number.isFinite(props.value) ? props.value : 0}
          onChange={(e) => props.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="num w-28 bg-transparent px-2 py-1.5 text-right text-[15px] outline-none sm:w-32"
        />
      </div>
    </Row>
  );
}
