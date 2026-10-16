"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { saveDeliveryRules } from "@/lib/actions/admin/delivery";
import { DELIVERY_SLOTS, type DeliveryZone } from "@/lib/delivery/rules";
import { EMIRATES } from "@/lib/constants/emirates";

interface Initial {
  zones: DeliveryZone[];
  sameDayCutoff: string;
  sameDayMinPrepHours: number;
  maxDaysAhead: number;
  closedWeekdays: number[];
  disabledSlots: string[];
  blackouts: { date: string; note: string }[];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ZoneRow = { emirate: (typeof EMIRATES)[number]; enabled: boolean; fee: string; freeOver: string; sameDay: boolean };

export function DeliveryForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneRow[]>(
    EMIRATES.map((e) => {
      const z = initial.zones.find((x) => x.emirate === e);
      return { emirate: e, enabled: z?.enabled ?? true, fee: String(z?.fee ?? 0), freeOver: z?.free_over == null ? "" : String(z.free_over), sameDay: z?.same_day ?? false };
    }),
  );
  const [cutoff, setCutoff] = useState(initial.sameDayCutoff);
  const [prep, setPrep] = useState(String(initial.sameDayMinPrepHours));
  const [maxDays, setMaxDays] = useState(String(initial.maxDaysAhead));
  const [closed, setClosed] = useState<number[]>(initial.closedWeekdays);
  const [disabledSlots, setDisabledSlots] = useState<string[]>(initial.disabledSlots);
  const [blackouts, setBlackouts] = useState(initial.blackouts);
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setZone = (i: number, patch: Partial<ZoneRow>) => setZones((z) => z.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allFree = zones.every((z) => !z.enabled || Number(z.fee) === 0);
  // Same-day only works while some slot is still far enough away: warn when the
  // cut-off promises more than the prep time allows.
  const lastSlotStart = Math.max(0, ...DELIVERY_SLOTS.filter((s) => !disabledSlots.includes(s.id)).map((s) => s.startHour * 60));
  const [ch, cm] = cutoff.split(":").map(Number);
  const effectiveCutoff = lastSlotStart - (Number(prep) || 0) * 60;
  const cutoffMin = (ch || 0) * 60 + (cm || 0);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await saveDeliveryRules({
      zones: zones.map((z) => ({
        emirate: z.emirate,
        enabled: z.enabled,
        fee: Number(z.fee) || 0,
        free_over: z.freeOver.trim() === "" ? null : Number(z.freeOver),
        same_day: z.sameDay,
      })),
      sameDayCutoff: cutoff,
      sameDayMinPrepHours: Number(prep) || 0,
      maxDaysAhead: Number(maxDays) || 60,
      closedWeekdays: closed,
      disabledSlots,
      blackouts,
    });
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved. Checkout uses the new rules immediately." } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {allFree && (
        <p className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Every delivery fee is currently AED 0, so all deliveries are free. Set real fees below if that is not what you want
          before launch.
        </p>
      )}

      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>Where we deliver and what it costs</MonoLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-start font-mono-label text-[10px] text-(--color-muted)">
                <th className="py-2 text-start">Emirate</th>
                <th className="text-start">Deliver</th>
                <th className="text-start">Fee (AED, before VAT)</th>
                <th className="text-start">Free over (AED)</th>
                <th className="text-start">Same-day</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, i) => (
                <tr key={z.emirate} className="border-t border-(--color-hairline)">
                  <td className="py-2 pe-3">{z.emirate}</td>
                  <td>
                    <input type="checkbox" checked={z.enabled} onChange={(e) => setZone(i, { enabled: e.target.checked })} aria-label={`Deliver to ${z.emirate}`} />
                  </td>
                  <td className="pe-3">
                    <input className="w-28 border border-(--color-hairline) px-2 py-1" type="number" min="0" step="0.01" value={z.fee} disabled={!z.enabled} onChange={(e) => setZone(i, { fee: e.target.value })} aria-label={`Fee for ${z.emirate}`} />
                  </td>
                  <td className="pe-3">
                    <input className="w-28 border border-(--color-hairline) px-2 py-1" type="number" min="0" step="0.01" placeholder="never" value={z.freeOver} disabled={!z.enabled} onChange={(e) => setZone(i, { freeOver: e.target.value })} aria-label={`Free delivery threshold for ${z.emirate}`} />
                  </td>
                  <td>
                    <input type="checkbox" checked={z.sameDay} disabled={!z.enabled} onChange={(e) => setZone(i, { sameDay: e.target.checked })} aria-label={`Same-day in ${z.emirate}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-(--color-muted)">
          &ldquo;Free over&rdquo; compares with the goods total before VAT and excluding deposits. Leave it empty to always charge the fee.
        </p>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>Same-day cut-off and booking window</MonoLabel>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Same-day cut-off (Dubai time, 24h)" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} hint="Orders at or after this time go to the next available day." />
          <Input label="Minimum prep for a same-day slot (hours)" type="number" min="0" max="12" value={prep} onChange={(e) => setPrep(e.target.value)} hint="A slot starting sooner than this from now can't be chosen." />
          <Input label="How far ahead customers can book (days)" type="number" min="1" max="365" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
        </div>
      </Card>

      {cutoffMin > effectiveCutoff && (
        <p className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          With your time windows and prep time, the last same-day slot can only be booked until {hhmm(Math.max(effectiveCutoff, 0))},
          earlier than the {cutoff} cut-off you set. Lower the prep time, or keep a later window on, to honour the cut-off.
        </p>
      )}

      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>Time windows</MonoLabel>
        <div className="flex flex-wrap gap-4 text-sm">
          {DELIVERY_SLOTS.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input type="checkbox" checked={!disabledSlots.includes(s.id)} onChange={() => setDisabledSlots((d) => toggle(d, s.id))} />
              {s.label}
            </label>
          ))}
        </div>
        <MonoLabel muted={false}>Weekly closed days</MonoLabel>
        <div className="flex flex-wrap gap-4 text-sm">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-2">
              <input type="checkbox" checked={closed.includes(i)} onChange={() => setClosed((c) => toggle(c, i))} />
              {d}
            </label>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>Closed dates (holidays, Eid, stock-take)</MonoLabel>
        <ul className="flex flex-col gap-1 text-sm">
          {blackouts.length === 0 && <li className="text-(--color-muted)">None.</li>}
          {blackouts.map((b) => (
            <li key={b.date} className="flex items-center justify-between border-b border-(--color-hairline) py-1">
              <span>
                {b.date}
                {b.note ? ` · ${b.note}` : ""}
              </span>
              <button type="button" className="font-mono-label text-[10px] text-red-600" onClick={() => setBlackouts((l) => l.filter((x) => x.date !== b.date))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid items-end gap-3 sm:grid-cols-[auto_1fr_auto]">
          <Input label="Date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Input label="Note (optional)" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <Button
            type="button"
            variant="secondary"
            disabled={!newDate || blackouts.some((b) => b.date === newDate)}
            onClick={() => {
              setBlackouts((l) => [...l, { date: newDate, note: newNote }].sort((a, b) => a.date.localeCompare(b.date)));
              setNewDate("");
              setNewNote("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      {msg && <p className={`text-sm ${msg.ok ? "text-(--color-primary)" : "text-red-700"}`}>{msg.text}</p>}
      <Button type="button" onClick={save} disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save delivery settings"}
      </Button>
    </div>
  );
}
