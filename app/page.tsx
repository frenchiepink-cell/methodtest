"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Daily = {
  weight: number | null;
  steps: number | null;
  sleep: number | null;
  calories: number | null;
  dietNotes: string;
};

export default function Today() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [date, setDate] = useState("");
  const [d, setD] = useState<Daily>({
    weight: null, steps: null, sleep: null, calories: null, dietNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDay(j.day);
        setCount(j.exerciseCount);
        setDate(j.date);
        setD(j.daily);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const field = (k: keyof Daily, v: string) => {
    setSaved(false);
    setD((p) => ({ ...p, [k]: v === "" ? null : k === "dietNotes" ? v : Number(v) }));
  };

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setSaved(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-zinc-500">Loading…</p>;

  return (
    <main className="p-5 pb-16">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">The Method.</h1>
        <span className="text-sm text-zinc-500">{date}</span>
      </header>

      {err && (
        <p className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {err}
        </p>
      )}

      <section className="mb-4 rounded-2xl border border-edge bg-card p-5">
        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">
          Today&rsquo;s session
        </p>
        {day ? (
          <>
            <p className="mb-1 text-xl font-semibold">{day}</p>
            <p className="mb-5 text-sm text-zinc-400">{count} exercises</p>
            <Link
              href="/session"
              className="block w-full rounded-xl bg-accent py-4 text-center text-lg font-semibold active:opacity-80"
            >
              Start session
            </Link>
          </>
        ) : (
          <p className="text-lg text-zinc-400">Nothing programmed today</p>
        )}
      </section>

      <section className="rounded-2xl border border-edge bg-card p-5">
        <p className="mb-4 text-xs uppercase tracking-widest text-zinc-500">Daily</p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          {([
            ["weight", "Weight (kg)"],
            ["steps", "Steps"],
            ["sleep", "Sleep (h)"],
            ["calories", "Calories"],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs text-zinc-500">{label}</span>
              <input
                inputMode="decimal"
                value={d[k] ?? ""}
                onChange={(e) => field(k, e.target.value)}
                className="h-14 w-full rounded-xl border border-edge bg-ink px-3 text-lg tabular-nums outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-zinc-500">Diet notes</span>
          <input
            value={d.dietNotes ?? ""}
            onChange={(e) => field("dietNotes", e.target.value)}
            className="h-14 w-full rounded-xl border border-edge bg-ink px-3 text-base outline-none focus:border-accent"
          />
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="h-14 w-full rounded-xl border border-edge bg-ink text-lg font-semibold active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </section>
    </main>
  );
}
