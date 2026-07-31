import { NextResponse } from "next/server";
import {
  queryDb, updatePage, num, txt, title, sel, multi, check, roll, today, daysBefore, wMulti,
} from "@/lib/notion";

const DB = process.env.NOTION_TRAINING_DB!;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const d = new URL(req.url).searchParams.get("date") || today();

    const todayRows = await queryDb(DB, {
      filter: { property: "Session Date", date: { equals: d } },
      sorts: [{ property: "Order", direction: "ascending" }],
    });

    if (!todayRows.results.length) {
      return NextResponse.json({ day: null, exercises: [] });
    }

    const day = sel((todayRows.results[0] as any).properties["Day"]);

    /* One query for history, not one per exercise — Notion rate-limits ~3 req/sec. */
    const history = await queryDb(DB, {
      filter: {
        and: [
          { property: "Day", select: { equals: day } },
          { property: "Session Date", date: { on_or_after: daysBefore(d, 60) } },
          { property: "Session Date", date: { before: d } },
        ],
      },
      sorts: [{ property: "Session Date", direction: "descending" }],
    });

    const last: Record<string, { weight: number | null; reps: string; rir: string }> = {};
    for (const r of history.results as any[]) {
      const name = title(r.properties["Exercise"]);
      if (name && !last[name]) {
        last[name] = {
          weight: num(r.properties["Weight (kg)"]),
          reps: txt(r.properties["Reps Done"]),
          rir: txt(r.properties["RIR"]),
        };
      }
    }

    const exercises = (todayRows.results as any[]).map((r) => {
      const name = title(r.properties["Exercise"]);
      return {
        id: r.id,
        name,
        variation: multi(r.properties["Machine / variation"]),
        order: num(r.properties["Order"]),
        target: txt(r.properties["Target"]),
        recReps: (() => {
          const explicit = txt(r.properties["Rec reps"]);
          if (explicit) return explicit;
          /* Target doubles as a coaching note — take the bit before the first
             em-dash or middot, e.g. "10/9/9/9 — MARKER · hold 20" -> "10/9/9/9" */
          return txt(r.properties["Target"]).split(/[—·]/)[0].trim();
        })(),
        targetNote: (() => {
          if (txt(r.properties["Rec reps"])) return txt(r.properties["Target"]);
          const t = txt(r.properties["Target"]);
          const i = t.search(/[—·]/);
          return i === -1 ? "" : t.slice(i + 1).trim();
        })(),
        recWeight: num(r.properties["Rec weight (kg)"]),
        rest: txt(r.properties["Rest"]),
        warmup: sel(r.properties["Warm-up"]),
        markerLift: check(r.properties["Marker Lift"]),
        coachNote: txt(r.properties["Coach note (exercise)"]),
        cueText: roll(r.properties["Cue text"]),
        lastWeight: last[name]?.weight ?? null,
        lastReps: last[name]?.reps ?? "",
        lastRir: last[name]?.rir ?? "",
        weight: num(r.properties["Weight (kg)"]),
        reps: txt(r.properties["Reps Done"]),
        rir: txt(r.properties["RIR"]),
      };
    });

    return NextResponse.json({ day, exercises });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { entries } = await req.json();
    let written = 0;

    /* Sequential with a gap. Notion allows roughly 3 requests a second. */
    for (const e of entries ?? []) {
      const props: any = {};

      /* Per-set entry collapsed into the two fields Notion has.
         All sets at one weight -> "12,10,9" (matches existing history).
         Weight varied         -> "20x12, 18x10, 18x9".
         Weight (kg) always gets the heaviest working set, so progression
         comparisons against Rec weight still work. */
      const sets = (e.sets ?? []).filter(
        (s: any) =>
          String(s.weight ?? "").trim() !== "" ||
          String(s.reps ?? "").trim() !== "" ||
          String(s.rir ?? "").trim() !== ""
      );
      if (sets.length) {
        const ws = sets
          .map((s: any) => Number(s.weight))
          .filter((n: number) => Number.isFinite(n));
        const uniform = ws.length > 0 && new Set(ws).size === 1;
        const line = uniform
          ? sets.map((s: any) => s.reps).filter(Boolean).join(",")
          : sets
              .map((s: any) => {
                const w = String(s.weight ?? "").trim();
                const r = String(s.reps ?? "").trim();
                return w && r ? `${w}x${r}` : w || r;
              })
              .filter(Boolean)
              .join(", ");
        if (line) props["Reps Done"] = { rich_text: [{ text: { content: line } }] };
        if (ws.length) props["Weight (kg)"] = { number: Math.max(...ws) };

        /* RIR is reported per set, one value each, e.g. "1/1/2". */
        const rirLine = sets
          .map((s: any) => String(s.rir ?? "").trim())
          .join("/")
          .replace(/^\/+|\/+$/g, "");
        if (rirLine.replace(/\//g, "")) {
          props["RIR"] = { rich_text: [{ text: { content: rirLine } }] };
        }
      }

      if (typeof e.note === "string" && e.note.trim() !== "")
        props["My note (exercise)"] = { rich_text: [{ text: { content: e.note } }] };
      if (Array.isArray(e.variation))
        props["Machine / variation"] = wMulti(e.variation);
      if (Object.keys(props).length === 0) continue;

      await updatePage(e.id, props);
      written++;
      await new Promise((r) => setTimeout(r, 350));
    }

    return NextResponse.json({ ok: true, written });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
