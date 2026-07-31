"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MACHINES = [
  "Free weights", "Cable", "Smith", "Unilateral", "Atlantis", "Prime",
  "Prime (Prone)", "Cybex", "Nautilus", "Arsenal", "Mirafit", "Shark",
  "Glute attack", "Glutinator", "Squat press", "Reverse Pec Deck",
];

type Ex = {
  id: string;
  name: string;
  variation: string[];
  target: string;
  recReps: string;
  targetNote: string;
  recWeight: number | null;
  rest: string;
  warmup: string | null;
  markerLift: boolean;
  coachNote: string;
  cueText: string;
  lastWeight: number | null;
  lastReps: string;
  lastRir: string;
  weight: number | null;
  reps: string;
  rir: string;
};

type SetRow = { weight: string; reps: string; rir: string };
type Entry = { sets: SetRow[]; note: string; variation: string[] };

/* "10/9/9/9" or "10,9,9,9" -> ["10","9","9","9"]. Drives how many set rows
   we open with, and the per-set rep placeholder. */
function targetSets(recReps: string): string[] {
  const parts = (recReps || "").split(/[\/,]/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [""];
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-500">Loading…</p>}>
      <Session />
    </Suspense>
  );
}

function Row({ label, weight, reps, rir, dim }: any) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className={dim ? "text-zinc-400" : "font-semibold"}>
        {weight || "—"}
        <span className="text-zinc-600"> × </span>
        {reps || "—"}
        {rir ? <span className="text-zinc-500"> @ {rir}</span> : null}
      </span>
    </div>
  );
}

function Session() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get("date") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [ex, setEx] = useState<Ex[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [openCue, setOpenCue] = useState<Record<string, boolean>>({});
  const [openMach, setOpenMach] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/session${date ? `?date=${date}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDay(j.day);
        setEx(j.exercises);
        const seed: Record<string, Entry> = {};
        for (const e of j.exercises as Ex[]) {
          seed[e.id] = {
            sets: targetSets(e.recReps).map(() => ({ weight: "", reps: "", rir: "" })),
            note: "",
            variation: e.variation ?? [],
          };
        }
        setEntries(seed);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const set = (id: string, k: keyof Entry, v: any) =>
    setEntries((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  const toggleMachine = (id: string, m: string) => {
    const cur = entries[id]?.variation ?? [];
    set(id, "variation", cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
  };

  const setField = (id: string, i: number, k: keyof SetRow, v: string) =>
    setEntries((p) => {
      const rows = [...p[id].sets];
      rows[i] = { ...rows[i], [k]: v };
      return { ...p, [id]: { ...p[id], sets: rows } };
    });

  const addSet = (id: string) =>
    setEntries((p) => ({ ...p, [id]: { ...p[id], sets: [...p[id].sets, { weight: "", reps: "", rir: "" }] } }));

  const removeSet = (id: string, i: number) =>
    setEntries((p) => ({
      ...p,
      [id]: { ...p[id], sets: p[id].sets.filter((_, j) => j !== i) },
    }));

  const isDone = (id: string) =>
    (entries[id]?.sets ?? []).some((s) => s.weight.trim() && s.reps.trim());
  const doneCount = ex.filter((e) => isDone(e.id)).length;

  /* Held locally until Finish — gyms have bad signal and a failed write
     must never wipe what was typed. */
  async function finish() {
    setSaving(true);
    setErr(null);
    try {
      const payload = ex.map((e) => ({ id: e.id, ...entries[e.id] }));
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      router.push("/");
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-zinc-500">Loading…</p>;

  if (!day)
    return (
      <main className="p-6">
        <p className="mb-4 text-lg text-zinc-400">Nothing programmed.</p>
        <button onClick={() => router.push("/")} className="text-accent">Back</button>
      </main>
    );

  return (
    <main className="pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-ink/95 px-5 py-4 backdrop-blur">
        <div>
          <p className="text-sm font-semibold leading-tight">{day}</p>
          <p className="text-xs text-zinc-500">{doneCount} / {ex.length} done</p>
        </div>
        <button onClick={finish} disabled={saving}
          className="rounded-xl bg-accent px-5 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50">
          {saving ? "Saving…" : "Finish"}
        </button>
      </header>

      {err && (
        <p className="m-5 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {err} — your entries are still here, press Finish to retry.
        </p>
      )}

      <div className="space-y-3 p-4">
        {ex.map((e) => {
          const v = entries[e.id]?.variation ?? [];
          return (
            <section key={e.id}
              className={`rounded-2xl border bg-card p-4 ${
                isDone(e.id) ? "border-l-4 border-l-accent border-edge" : "border-edge"
              }`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold leading-tight">{e.name}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  {e.warmup && e.warmup !== "N/A" && e.warmup !== "None" && (
                    <span className="rounded-md border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                      {e.warmup}
                    </span>
                  )}
                  {e.markerLift && (
                    <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-indigo-300">
                      marker
                    </span>
                  )}
                  {isDone(e.id) && <span className="text-accent">✓</span>}
                </div>
              </div>

              {/* Machine — tap to change */}
              <button
                onClick={() => setOpenMach((p) => ({ ...p, [e.id]: !p[e.id] }))}
                className="mb-2 flex w-full flex-wrap items-center gap-1 text-left"
              >
                {v.length ? (
                  v.map((m) => (
                    <span key={m} className="rounded-md border border-edge px-2 py-1 text-xs text-zinc-300">
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">No machine set</span>
                )}
                <span className="ml-1 text-xs text-accent">
                  {openMach[e.id] ? "done" : "change"}
                </span>
              </button>

              {openMach[e.id] && (
                <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-edge bg-ink p-3">
                  {MACHINES.map((m) => (
                    <button key={m} onClick={() => toggleMachine(e.id, m)}
                      className={`min-h-[40px] rounded-lg border px-3 text-xs ${
                        v.includes(m)
                          ? "border-accent bg-accent/20 text-indigo-200"
                          : "border-edge text-zinc-400"
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              )}

              <div className="mb-3 space-y-1">
                <Row
                  label="Last"
                  weight={e.lastWeight != null ? `${e.lastWeight}kg` : ""}
                  reps={e.lastReps}
                  rir={e.lastRir}
                  dim
                />
                <Row
                  label="Target"
                  weight={e.recWeight != null ? `${e.recWeight}kg` : ""}
                  reps={e.recReps}
                />
                {e.rest && (
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="w-14 shrink-0 text-[10px] uppercase tracking-widest text-zinc-500">
                      Rest
                    </span>
                    <span className="text-zinc-400">{e.rest}</span>
                  </div>
                )}
              </div>

              {(e.weight != null || e.reps) && (
                <p className="mb-2 text-sm text-amber-400/80">
                  Already in Notion: {e.weight ?? "—"}kg × {e.reps || "—"}
                  {e.rir ? ` @ ${e.rir}` : ""}
                </p>
              )}

              {e.targetNote && (
                <p className="mb-3 text-sm leading-snug text-zinc-400">{e.targetNote}</p>
              )}

              {e.coachNote && (
                <p className="mb-3 rounded-xl bg-indigo-950/40 p-3 text-sm text-indigo-200">
                  {e.coachNote}
                </p>
              )}

              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-600">
                  <span className="w-5 shrink-0" />
                  <span className="flex-[3] text-center">kg</span>
                  <span className="w-3 shrink-0" />
                  <span className="flex-[2] text-center">reps</span>
                  <span className="w-3 shrink-0" />
                  <span className="w-14 shrink-0 text-center">rir</span>
                  <span className="w-6 shrink-0" />
                </div>
                {(entries[e.id]?.sets ?? []).map((row, i) => {
                  const prev = entries[e.id]?.sets?.[i - 1]?.weight;
                  const wPlaceholder =
                    prev && prev.trim() !== ""
                      ? prev
                      : e.recWeight != null
                      ? String(e.recWeight)
                      : "";
                  const prevRir = entries[e.id]?.sets?.[i - 1]?.rir;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-5 shrink-0 text-xs text-zinc-500">{i + 1}</span>
                      <input type="text" inputMode="decimal"
                        value={row.weight}
                        placeholder={wPlaceholder}
                        onChange={(ev) => setField(e.id, i, "weight", ev.target.value.replace(",", "."))}
                        className="h-14 min-w-0 flex-[3] rounded-xl border border-edge bg-ink px-2 text-center text-lg tabular-nums outline-none placeholder:text-zinc-600 focus:border-accent" />
                      <span className="shrink-0 text-sm text-zinc-600">×</span>
                      <input type="text" inputMode="numeric"
                        value={row.reps}
                        placeholder={targetSets(e.recReps)[i] ?? ""}
                        onChange={(ev) => setField(e.id, i, "reps", ev.target.value)}
                        className="h-14 min-w-0 flex-[2] rounded-xl border border-edge bg-ink px-2 text-center text-lg tabular-nums outline-none placeholder:text-zinc-600 focus:border-accent" />
                      <span className="shrink-0 text-sm text-zinc-600">@</span>
                      <input type="text" inputMode="numeric"
                        value={row.rir}
                        placeholder={prevRir && prevRir.trim() !== "" ? prevRir : "–"}
                        onChange={(ev) => setField(e.id, i, "rir", ev.target.value)}
                        className="h-14 w-14 shrink-0 rounded-xl border border-edge bg-ink px-1 text-center text-lg tabular-nums outline-none placeholder:text-zinc-600 focus:border-accent" />
                      <button onClick={() => removeSet(e.id, i)}
                        className="h-14 w-6 shrink-0 text-lg text-zinc-600 active:text-zinc-300">−</button>
                    </div>
                  );
                })}
                <button onClick={() => addSet(e.id)}
                  className="h-11 w-full rounded-xl border border-dashed border-edge text-sm text-zinc-500 active:text-zinc-300">
                  + Add set
                </button>

              </div>

              <input value={entries[e.id]?.note ?? ""}
                onChange={(ev) => set(e.id, "note", ev.target.value)}
                placeholder="How did it feel?"
                className="mb-2 h-12 w-full rounded-xl border border-edge bg-ink px-3 text-base outline-none placeholder:text-zinc-600 focus:border-accent" />

              {e.cueText && (
                <>
                  <button onClick={() => setOpenCue((p) => ({ ...p, [e.id]: !p[e.id] }))}
                    className="text-xs uppercase tracking-widest text-zinc-500">
                    {openCue[e.id] ? "Hide cue" : "Cue"}
                  </button>
                  {openCue[e.id] && <p className="mt-2 text-sm text-zinc-400">{e.cueText}</p>}
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
