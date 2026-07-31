"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type D = Record<string, any>;

const CARDIO = ["Dance", "Posing", "Stairmaster", "Walk", "Bike", "Steady cardio", "Other"];
const MEDS = ["Citalopram 10mg", "Elvanse 50mg", "Folic acid 5mg", "Methotrexate 20mg", "Infliximab", "None"];
const SUPPS = ["Krill oil", "Vitamin C", "Magnesium", "Zinc", "Iron", "Electrolytes", "Vitamin D3", "Creatine 5g", "Protein powder", "Omega 3", "None"];
const DISCHARGE = ["Dry", "Sticky", "Creamy", "Egg-white", "Watery", "Spotting", "Period"];
const LIBIDO = ["Low", "Normal", "High"];
const GOALS = ["Bulk", "Comp prep", "Cut", "Figuring out maintenance", "Maintenance / Recomp", "Mini cut", "Refeed"];

function shift(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/* ---------- small UI pieces ---------- */
function Section({ title, open, onToggle, children }: any) {
  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-edge bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-xs uppercase tracking-widest text-zinc-400">{title}</span>
        <span className="text-zinc-500">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function Num({ label, value, onChange }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        className="h-14 w-full rounded-xl border border-edge bg-ink px-3 text-lg tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

function Toggle({ label, on, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm ${
        on ? "border-accent bg-accent/20 text-indigo-200" : "border-edge text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}

function Chips({ options, value, onChange }: any) {
  const v: string[] = value ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o: string) => (
        <Toggle
          key={o}
          label={o}
          on={v.includes(o)}
          onClick={() => onChange(v.includes(o) ? v.filter((x) => x !== o) : [...v, o])}
        />
      ))}
    </div>
  );
}

function Pick({ options, value, onChange }: any) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o: string) => (
        <Toggle key={o} label={o} on={value === o} onClick={() => onChange(value === o ? null : o)} />
      ))}
    </div>
  );
}

/* ---------- page ---------- */
export default function Today() {
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [cycle, setCycle] = useState({ cycleDay: "", phase: "" });
  const [d, setD] = useState<D>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ body: true, macros: true });

  const load = useCallback((iso: string) => {
    setLoading(true);
    setSaved(false);
    setErr(null);
    fetch(`/api/today?date=${iso}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDay(j.day);
        setCount(j.exerciseCount);
        setD(j.daily);
        setCycle({ cycleDay: j.cycleDay, phase: j.phase });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const f = (k: string) => (v: any) => { setSaved(false); setD((p) => ({ ...p, [k]: v })); };
  const tgl = (k: string) => () => { setSaved(false); setD((p) => ({ ...p, [k]: !p[k] })); };
  const sec = (k: string) => () => setOpen((p) => ({ ...p, [k]: !p[k] }));

  async function save() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, daily: d }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setSaved(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const isToday = date === todayISO();
  const label = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <main className="p-4 pb-32">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">The Method.</h1>
        {!isToday && (
          <button onClick={() => setDate(todayISO())} className="text-sm text-accent">
            Today
          </button>
        )}
      </header>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-edge bg-card px-2 py-2">
        <button onClick={() => setDate(shift(date, -1))} className="h-12 w-14 rounded-xl text-2xl text-zinc-400 active:bg-ink">‹</button>
        <div className="text-center">
          <p className="text-base font-semibold">{isToday ? "Today" : label}</p>
          <p className="text-xs text-zinc-500">
            {date}{cycle.cycleDay && ` · CD${cycle.cycleDay}`}{cycle.phase && ` · ${cycle.phase}`}
          </p>
        </div>
        <button
          onClick={() => setDate(shift(date, 1))}
          disabled={isToday}
          className="h-12 w-14 rounded-xl text-2xl text-zinc-400 active:bg-ink disabled:opacity-25"
        >›</button>
      </div>

      {err && <p className="mb-3 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{err}</p>}
      {loading && <p className="p-2 text-zinc-500">Loading…</p>}

      {!loading && (
        <>
          <section className="mb-3 rounded-2xl border border-edge bg-card p-5">
            <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Session</p>
            {day ? (
              <>
                <p className="mb-1 text-lg font-semibold">{day}</p>
                <p className="mb-4 text-sm text-zinc-400">{count} exercises</p>
                <Link href={`/session?date=${date}`} className="block w-full rounded-xl bg-accent py-4 text-center text-lg font-semibold active:opacity-80">
                  {isToday ? "Start session" : "Open session"}
                </Link>
              </>
            ) : (
              <p className="text-zinc-400">Nothing programmed</p>
            )}
          </section>

          <Section title="Body" open={open.body} onToggle={sec("body")}>
            <div className="grid grid-cols-2 gap-3">
              <Num label="Weight (kg)" value={d.weight} onChange={f("weight")} />
              <Num label="Waist (in)" value={d.waist} onChange={f("waist")} />
              <Num label="Body fat %" value={d.bodyFat} onChange={f("bodyFat")} />
              <Num label="Sleep (h)" value={d.sleep} onChange={f("sleep")} />
            </div>
          </Section>

          <Section title="Macros" open={open.macros} onToggle={sec("macros")}>
            <div className="grid grid-cols-2 gap-3">
              <Num label="Calories" value={d.calories} onChange={f("calories")} />
              <Num label="Protein (g)" value={d.protein} onChange={f("protein")} />
              <Num label="Carbs (g)" value={d.carbs} onChange={f("carbs")} />
              <Num label="Fat (g)" value={d.fat} onChange={f("fat")} />
              <Num label="Fibre (g)" value={d.fibre} onChange={f("fibre")} />
              <Num label="Sat fat (g)" value={d.satFat} onChange={f("satFat")} />
              <Num label="Water (L)" value={d.water} onChange={f("water")} />
              <Num label="Table salt (g)" value={d.tableSalt} onChange={f("tableSalt")} />
              <Num label="LoSalt (g)" value={d.loSalt} onChange={f("loSalt")} />
            </div>
            <p className="mb-1 mt-4 text-xs text-zinc-500">Diet notes</p>
            <textarea rows={3} value={d.dietNotes ?? ""} onChange={(e) => f("dietNotes")(e.target.value)}
              className="w-full rounded-xl border border-edge bg-ink p-3 text-base outline-none focus:border-accent" />
            <p className="mb-2 mt-4 text-xs text-zinc-500">Goal</p>
            <Pick options={GOALS} value={d.goal} onChange={f("goal")} />
          </Section>

          <Section title="Activity" open={open.act} onToggle={sec("act")}>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Num label="Steps" value={d.steps} onChange={f("steps")} />
              <Num label="Intensity mins" value={d.intensityMins} onChange={f("intensityMins")} />
            </div>
            <Chips options={CARDIO} value={d.otherCardio} onChange={f("otherCardio")} />
          </Section>

          <Section title="Recovery & tripwires" open={open.rec} onToggle={sec("rec")}>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Num label="Resting HR" value={d.restingHR} onChange={f("restingHR")} />
              <Num label="BP pulse" value={d.bpPulse} onChange={f("bpPulse")} />
              <Num label="BP SYS" value={d.bpSys} onChange={f("bpSys")} />
              <Num label="BP DIA" value={d.bpDia} onChange={f("bpDia")} />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Toggle label="Gut flare" on={d.twGut} onClick={tgl("twGut")} />
              <Toggle label="Joint/flare" on={d.twJoint} onClick={tgl("twJoint")} />
              <Toggle label="Low energy" on={d.twEnergy} onClick={tgl("twEnergy")} />
              <Toggle label="Poor sleep" on={d.twSleep} onClick={tgl("twSleep")} />
            </div>
            <p className="mb-2 text-xs text-zinc-500">Symptoms</p>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Dizziness" on={d.sxDizziness} onClick={tgl("sxDizziness")} />
              <Toggle label="Headache" on={d.sxHeadache} onClick={tgl("sxHeadache")} />
              <Toggle label="Palpitations" on={d.sxPalpitations} onClick={tgl("sxPalpitations")} />
              <Toggle label="Other" on={d.sxOther} onClick={tgl("sxOther")} />
            </div>
            <p className="mb-1 mt-4 text-xs text-zinc-500">Notes (flare/joint/gut/energy)</p>
            <textarea rows={3} value={d.notes ?? ""} onChange={(e) => f("notes")(e.target.value)}
              className="w-full rounded-xl border border-edge bg-ink p-3 text-base outline-none focus:border-accent" />
          </Section>

          <Section title="Cycle" open={open.cyc} onToggle={sec("cyc")}>
            <div className="mb-4">
              <Toggle
                label={d.periodStart === date ? "Period started today ✓" : "Mark period start"}
                on={d.periodStart === date}
                onClick={() => { setSaved(false); setD((p) => ({ ...p, periodStart: p.periodStart === date ? null : date })); }}
              />
            </div>
            <p className="mb-2 text-xs text-zinc-500">Discharge</p>
            <div className="mb-4"><Pick options={DISCHARGE} value={d.discharge} onChange={f("discharge")} /></div>
            <p className="mb-2 text-xs text-zinc-500">Libido</p>
            <div className="mb-4"><Pick options={LIBIDO} value={d.libido} onChange={f("libido")} /></div>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Cramps" on={d.cramps} onClick={tgl("cramps")} />
              <Toggle label="Bloating" on={d.bloating} onClick={tgl("bloating")} />
              <Toggle label="Breast tender" on={d.breastTenderness} onClick={tgl("breastTenderness")} />
              <Toggle label="Mood shift" on={d.moodShift} onClick={tgl("moodShift")} />
            </div>
          </Section>

          <Section title="Meds & supplements" open={open.med} onToggle={sec("med")}>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Num label="Elvanse (mg)" value={d.elvanse} onChange={f("elvanse")} />
              <Num label="Reta dose (mg)" value={d.reta} onChange={f("reta")} />
            </div>
            <p className="mb-2 text-xs text-zinc-500">Prescription meds</p>
            <div className="mb-4"><Chips options={MEDS} value={d.meds} onChange={f("meds")} /></div>
            <p className="mb-2 text-xs text-zinc-500">Supplements taken</p>
            <Chips options={SUPPS} value={d.supps} onChange={f("supps")} />
          </Section>

          {d.coachNote && (
            <section className="mb-3 rounded-2xl border border-edge bg-indigo-950/30 p-5">
              <p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">Coach note</p>
              <p className="text-sm text-indigo-100">{d.coachNote}</p>
            </section>
          )}
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-edge bg-ink/95 p-4 backdrop-blur">
        <button onClick={save} disabled={saving || loading}
          className="h-14 w-full rounded-xl bg-accent text-lg font-semibold active:opacity-80 disabled:opacity-50">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save day"}
        </button>
      </div>
    </main>
  );
}
