import type { ReactNode } from "react";

/** Numbered manuscript section: "01 — The Deceased". */
export function SectionShell({
  no,
  title,
  arabic,
  lede,
  children,
  id,
}: {
  no: string;
  title: string;
  arabic?: string;
  lede?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t-2 border-ink pt-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-3xl font-light text-gilt">{no}</span>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        {arabic && <span className="arabic text-xl text-leaf">{arabic}</span>}
      </div>
      {lede && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{lede}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
