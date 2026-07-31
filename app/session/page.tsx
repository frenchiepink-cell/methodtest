"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Ex = {
  id: string;
  name: string;
  variation: string[];
  target: string;
  recWeight: number | null;
  rest: string;
  warmup: string | null;
  markerLift: boolean;
  coachNote: string;
  cueText: string;
  lastWeight: number | null;
  lastReps: string;
  weight: number | null;
  reps: string;
};

type Entry = { weight: string; reps: string; note: string };

export default function Session() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [ex, setEx] = useState<Ex[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [openCue, setOpenCue] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDay(j.day);
        setEx(j.exercises);
        const seed: Record<string, Entry> = {};
        for (const e of j.exercises as Ex[]) {
          seed[e.id] = {
            weight: e.weight != null ? String(e.weight) : "",
            reps: e.reps ?? "",
            note: "",
          };
        }
        setEntries(seed);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (id: string, k: keyof Entry, v: string) =>
    setEntries((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  const isDone = (id: string) =>
    !!entries[id]?.weight?.trim() && !!entries[id]?.reps?.trim();
  const doneCount = ex.filter((e) => isDone(e.id)).length;

  /* Everything is held locally until Finish. Gyms have bad signal, and a failed
     write must never wipe what was typed. */
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
        <p className="mb-4 text-lg text-zinc-400">Nothing programmed today.</p>
        <button onClick={() => router.push("/")} className="text-accent">
          Back
        </button>
      </main>
    );

  return (
    <main className="pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-ink/95 px-5 py-4 backdrop-blur">
        <div>
          <p className="text-sm font-semibold leading-tight">{day}</p>
          <p className="text-xs text-zinc-500">
            {doneCount} / {ex.length} done
          </p>
        </div>
        <button
          onClick={finish}
          disabled={saving}
          className="rounded-xl bg-accent px-5 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Finish"}
        </button>
      </header>

      {err && (
        <p className="m-5 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {err} — your entries are still here, press Finish to retry.
        </p>
      )}

      <div className="space-y-3 p-4">
        {ex.map((e) => (
          <section
            key={e.id}
            className={`rounded-2xl border bg-card p-4 ${
              isDone(e.id) ? "border-l-4 border-l-accent border-edge" : "border-edge"
            }`}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold leading-tight">{e.name}</h2>
              {isDone(e.id) && <span className="text-accent">✓</span>}
            </div>

            {e.variation.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {e.variation.map((v) => (
                  <span
                    key={v}
                    className="rounded-md border border-edge px-2 py-0.5 text-xs text-zinc-400"
                  >
                    {v}
                  </span>
                ))}
                {e.markerLift && (
                  <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs text-indigo-300">
                    marker
                  </span>
                )}
              </div>
            )}

            <p className="text-sm text-zinc-500">
              {e.lastWeight != null || e.lastReps
                ? `Last: ${e.lastWeight ?? "—"}kg × ${e.lastReps || "—"}`
                : "First time"}
            </p>
            <p className="mb-3 text-sm text-zinc-400">
              Target: {e.target || "—"}
              {e.recWeight != null && ` · Rec: ${e.recWeight}kg`}
              {e.rest && ` · Rest: ${e.rest}`}
            </p>

            {e.coachNote && (
              <p className="mb-3 rounded-xl bg-indigo-950/40 p-3 text-sm text-indigo-200">
                {e.coachNote}
              </p>
            )}

            <div className="mb-2 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs text-zinc-500">Weight (kg)</span>
                <input
                  inputMode="decimal"
                  value={entries[e.id]?.weight ?? ""}
                  onChange={(ev) => set(e.id, "weight", ev.target.value)}
                  className="h-14 w-full rounded-xl border border-edge bg-ink px-3 text-lg tabular-nums outline-none focus:border-accent"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">Reps done</span>
                <input
                  value={entries[e.id]?.reps ?? ""}
                  onChange={(ev) => set(e.id, "reps", ev.target.value)}
                  placeholder="12,10,9"
                  className="h-14 w-full rounded-xl border border-edge bg-ink px-3 text-lg outline-none focus:border-accent"
                />
              </label>
            </div>

            <input
              value={entries[e.id]?.note ?? ""}
              onChange={(ev) => set(e.id, "note", ev.target.value)}
              placeholder="How did it feel?"
              className="mb-2 h-12 w-full rounded-xl border border-edge bg-ink px-3 text-base outline-none focus:border-accent"
            />

            {e.cueText && (
              <>
                <button
                  onClick={() => setOpenCue((p) => ({ ...p, [e.id]: !p[e.id] }))}
                  className="text-xs uppercase tracking-widest text-zinc-500"
                >
                  {openCue[e.id] ? "Hide cue" : "Cue"}
                </button>
                {openCue[e.id] && (
                  <p className="mt-2 text-sm text-zinc-400">{e.cueText}</p>
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
