"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MACHINES = [
  "Free weights", "Cable", "Smith", "Unilateral", "Atlantis", "Prime",
  "Prime (Prone)", "Cybex", "Nautilus", "Arsenal", "Mirafit", "Shark",
  "Glute attack", "Glutinator", "Squat press", "Reverse Pec Deck",
  "StairMaster", "Not my usual one",
];

type Ex = {
  id: string;
  name: string;
  variation: string[];
  target: string;
  targetReps: string;
  recWeight: number | null;
  rest: string;
  warmup: string | null;
  markerLift: boolean;
  coachNote: string;
  targetRir: string;
  cueText: string;
  lastWeight: number | null;
  lastReps: string;
  lastRir: string;
  weight: number | null;
  reps: string;
  rir: string;
  myNote: string;
};

type SetRow = { weight: string; reps: string; rir: string };
type Entry = { sets: SetRow[]; note: string; variation: string[]; variationChanged: boolean };

/* One row to start with. Weight comes prefilled with the recommendation as a
   real value — not a grey placeholder — so it saves whether or not she retypes
   it, and so an untouched box can never be read as 0kg. Extra sets on demand. */
function seedEntry(e: Ex): Entry {
  return {
    sets: [{ weight: e.recWeight != null ? String(e.recWeight) : "", reps: "", rir: "" }],
    note: "",
    variation: e.variation ?? [],
    variationChanged: false,
  };
}

const storeKey = (date: string) => `method:session:${date || "today"}`;

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
  const [result, setResult] = useState<any>(null);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/session${date ? `?date=${date}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) throw new Error(j.error);
        setDay(j.day);
        setEx(j.exercises);

        const seed: Record<string, Entry> = {};
        for (const e of j.exercises as Ex[]) seed[e.id] = seedEntry(e);

        /* A phone can evict a home-screen web app from memory at any point in
           a 90-minute session. Anything typed is written to the device as it
           is typed, so a reload resumes instead of silently starting over. */
        try {
          const raw = localStorage.getItem(storeKey(j.date ?? date));
          if (raw) {
            const prev = JSON.parse(raw) as Record<string, Entry>;
            let any = false;
            for (const id of Object.keys(seed)) {
              if (prev[id]) {
                seed[id] = { ...seed[id], ...prev[id] };
                any = true;
              }
            }
            if (any) setRestored(true);
          }
        } catch {
          /* private mode or quota — carry on with a fresh session */
        }

        setEntries(seed);
        hydrated.current = true;
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(storeKey(date), JSON.stringify(entries));
    } catch {
      /* nothing we can do; the in-memory copy is still live */
    }
  }, [entries, date]);

  const set = (id: string, k: keyof Entry, v: any) => {
    setResult(null);
    setEntries((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  };

  const toggleMachine = (id: string, m: string) => {
    const cur = entries[id]?.variation ?? [];
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    setResult(null);
    setEntries((p) => ({
      ...p,
      [id]: { ...p[id], variation: next, variationChanged: true },
    }));
  };

  const setField = (id: string, i: number, k: keyof SetRow, v: string) => {
    setResult(null);
    setEntries((p) => {
      const rows = [...(p[id]?.sets ?? [])];
      rows[i] = { ...rows[i], [k]: v };
      return { ...p, [id]: { ...p[id], sets: rows } };
    });
  };

  /* A new set inherits the weight above it — the common case is another set at
     the same load, and it keeps the "one line" default honest. */
  const addSet = (id: string) =>
    setEntries((p) => {
      const rows = p[id]?.sets ?? [];
      const prev = rows[rows.length - 1];
      return {
        ...p,
        [id]: { ...p[id], sets: [...rows, { weight: prev?.weight ?? "", reps: "", rir: "" }] },
      };
    });

  const removeSet = (id: string, i: number) =>
    setEntries((p) => ({
      ...p,
      [id]: { ...p[id], sets: (p[id]?.sets ?? []).filter((_, j) => j !== i) },
    }));

  /* Reps are what make a set real. The weight is prefilled, so weight alone
     would mark every card done the moment the screen loaded. */
  const isDone = (id: string) =>
    (entries[id]?.sets ?? []).some((s) => s.reps.trim() !== "");
  const doneCount = ex.filter((e) => isDone(e.id)).length;

  const finish = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setResult(null);
    try {
      const payload = ex.map((e) => ({
        id: e.id,
        name: e.name,
        ...(entries[e.id] ?? seedEntry(e)),
      }));
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, entries: payload }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setResult(j);
      if (j.ok) {
        try {
          localStorage.removeItem(storeKey(date));
        } catch {}
        router.push("/");
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }, [ex, entries, date, router]);

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
          <p className="text-xs text-zinc-500">{doneCount} / {ex.length} logged</p>
        </div>
        <button onClick={finish} disabled={saving || doneCount === 0}
          className="rounded-xl bg-accent px-5 py-3 text-base font-semibold active:opacity-80 disabled:opacity-40">
          {saving ? "Saving…" : "Finish"}
        </button>
      </header>

      {restored && (
        <p className="mx-4 mt-4 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          Picked up where you left off — nothing you typed was lost.
        </p>
      )}

      {doneCount === 0 && (
        <p className="mx-4 mt-4 rounded-xl border border-edge bg-card p-3 text-sm text-zinc-400">
          Enter reps on at least one exercise. Finish stays disabled until then —
          it can no longer report a save that wrote nothing.
        </p>
      )}

      {err && (
        <p className="m-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {err} — your entries are still here, press Finish to retry.
        </p>
      )}

      {result && !result.ok && (
        <div className="m-4 rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          <p className="mb-2 font-semibold">Not everything saved — nothing has been cleared.</p>
          {result.failed?.length > 0 && (
            <p className="mb-1">
              Rejected by Notion: {result.failed.map((f: any) => `${f.name} (${f.error})`).join(", ")}
            </p>
          )}
          {result.verified?.filter((v: any) => !v.present || (!v.reps && v.weight == null)).length > 0 && (
            <p className="mb-1">
              Sent but not found on read-back:{" "}
              {result.verified
                .filter((v: any) => !v.present || (!v.reps && v.weight == null))
                .map((v: any) => v.name)
                .join(", ")}
            </p>
          )}
          {result.dropped?.length > 0 && (
            <p className="mb-1">
              These fields no longer exist in Notion and were not written:{" "}
              <strong>{result.dropped.join(", ")}</strong>. Someone renamed them — everything
              else saved.
            </p>
          )}
          {result.verifyError && <p className="mb-1">Could not verify: {result.verifyError}</p>}
          <p>Press Finish to retry.</p>
        </div>
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
                  reps={e.targetReps}
                  rir={e.targetRir}
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

              {/* The coach's prose, shown whole — no longer split on punctuation. */}
              {e.target && (
                <p className="mb-3 text-sm leading-snug text-zinc-400">{e.target}</p>
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
                  const prevRir = entries[e.id]?.sets?.[i - 1]?.rir;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-5 shrink-0 text-xs text-zinc-500">{i + 1}</span>
                      <input type="text" inputMode="decimal"
                        value={row.weight}
                        onChange={(ev) => setField(e.id, i, "weight", ev.target.value.replace(",", "."))}
                        className="h-14 min-w-0 flex-[3] rounded-xl border border-edge bg-ink px-2 text-center text-lg tabular-nums outline-none placeholder:text-zinc-600 focus:border-accent" />
                      <span className="shrink-0 text-sm text-zinc-600">×</span>
                      <input type="text" inputMode="numeric"
                        value={row.reps}
                        placeholder={e.targetReps ? e.targetReps.split(/[\/,]/)[i]?.trim() ?? "" : ""}
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
