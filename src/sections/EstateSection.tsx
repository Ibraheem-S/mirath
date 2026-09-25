import type { EstateInput } from "@/engine";
import { SectionShell } from "@/components/SectionShell";
import { MoneyField, ToggleField } from "@/components/Field";

const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "BDT", "MYR", "IDR", "SAR", "AED", "EGP", "NGN", "ZAR"];

export function EstateSection({
  estate,
  onChange,
}: {
  estate: EstateInput;
  onChange: (patch: Partial<EstateInput>) => void;
}) {
  const afterObligations = Math.max(0, estate.grossEstate - estate.funeralCosts - estate.debts);
  const cap = afterObligations / 3;
  return (
    <SectionShell
      id="estate"
      no="03"
      title="Estate, Debts & Bequest"
      arabic="التركة والوصية"
      lede="Islamic law fixes the order: funeral costs, then debts, then the bequest (wasiyya) — only what remains is inherited. Quran 4:11–12 repeat 'after any bequest or debt' three times."
    >
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="currency" className="text-sm text-ink-soft">Currency</label>
        <select
          id="currency"
          value={estate.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
          className="border border-ink/30 bg-paper-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-leaf"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-x-10 lg:grid-cols-2">
        <div>
          <MoneyField
            label="Gross estate" arabic="التركة" value={estate.grossEstate} currency={estate.currency}
            onChange={(v) => onChange({ grossEstate: v })}
            hint="Everything owned at death: cash, property value, investments, unpaid wages due."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">The tarika</p>
                <p className="mt-1">
                  All property the deceased owned outright at death. Life-insurance payouts, joint
                  accounts, and pension death-benefits follow their own legal form and may sit
                  outside the tarika — a scholar or local attorney can confirm your jurisdiction.
                </p>
              </>
            }
          />
          <MoneyField
            label="Funeral & burial costs" value={estate.funeralCosts} currency={estate.currency}
            onChange={(v) => onChange({ funeralCosts: v })}
            hint="Reasonable costs of washing, shrouding, burial — paid first, by consensus."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">First charge</p>
                <p className="mt-1">
                  The four schools agree reasonable funeral expenses come off the top, before debts
                  and before any inheritance.
                </p>
              </>
            }
          />
        </div>
        <div>
          <MoneyField
            label="Debts" arabic="الديون" value={estate.debts} currency={estate.currency}
            onChange={(v) => onChange({ debts: v })}
            hint="All debts — including unpaid zakat and unperformed obligatory hajj costs per most scholars."
            tip={
              <>
                <p className="font-semibold text-gilt-soft">Before inheritance</p>
                <p className="mt-1">
                  Quran 4:11 — shares are distributed only 'after any bequest or debt'. The Prophet
                  ﷺ refused to pray over a debtor until the debt was settled (Abu Dawud 2715). If
                  debts exceed the estate the tool will tell you the estate is insolvent.
                </p>
              </>
            }
          />
          <MoneyField
            label="Bequest (wasiyya)" arabic="الوصية" value={estate.wasiyyaAmount} currency={estate.currency}
            onChange={(v) => onChange({ wasiyyaAmount: v })}
            hint={`Capped at one third after debts: ${estate.currency} ${cap.toFixed(2)}. Excess needs all heirs' consent.`}
            tip={
              <>
                <p className="font-semibold text-gilt-soft">At most one third, to non-heirs</p>
                <p className="mt-1">
                  Sa'd ibn Abi Waqqas asked to give away half his wealth in charity at death; the
                  Prophet ﷺ said: 'A third — and a third is much' (Sahih al-Bukhari 2742, Sahih
                  Muslim 1628). Beyond ⅓ requires the free consent of every adult heir after death.
                  Here the cap is ⅓ × ({estate.grossEstate} − {estate.funeralCosts} −{" "}
                  {estate.debts}) = {cap.toFixed(2)}.
                </p>
              </>
            }
          />
          {estate.wasiyyaAmount > 0 && (
            <ToggleField
              label="Bequest goes to a legal heir?"
              value={estate.wasiyyaRecipientIsHeir}
              onChange={(v) => onChange({ wasiyyaRecipientIsHeir: v })}
              hint="'No bequest for an heir' — Jami' at-Tirmidhi 2120."
              tip={
                <>
                  <p className="font-semibold text-gilt-soft">La wasiyyata li-warith</p>
                  <p className="mt-1">
                    The Prophet ﷺ declared in the Farewell Sermon: 'Allah has given each rightful
                    person their right — so there is no bequest for an heir' (Tirmidhi 2120; Abu
                    Dawud 2870; graded hasan-sahih). A bequest to someone who already inherits is
                    suspended unless all adult heirs consent after the death; the Hanafi school
                    insists the consent come after death, not before. Bequests are meant for
                    non-heirs: charity, friends, or relatives who do not inherit.
                  </p>
                </>
              }
            />
          )}
        </div>
      </div>
    </SectionShell>
  );
}
