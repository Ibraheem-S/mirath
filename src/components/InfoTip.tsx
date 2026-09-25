import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Marginalia note — a small circled-i that reveals the underlying math / law. */
export function InfoTip({ children, label = "more" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-leaf/40 text-leaf transition-colors hover:bg-leaf hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
        >
          <Info size={11} strokeWidth={2.4} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        collisionPadding={12}
        className="max-w-[19rem] border border-gilt/60 bg-ink px-3.5 py-3 text-left text-[12.5px] leading-relaxed text-paper shadow-xl"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
