import { NextResponse } from "next/server";
import {
  queryDb, updatePage, num, txt, title, sel, multi, check, roll, today, daysBefore,
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

    const last: Record<string, { weight: number | null; reps: string }> = {};
    for (const r of history.results as any[]) {
      const name = title(r.properties["Exercise"]);
      if (name && !last[name]) {
        last[name] = {
          weight: num(r.properties["Weight (kg)"]),
          reps: txt(r.properties["Reps Done"]),
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
        recWeight: num(r.properties["Rec weight (kg)"]),
        rest: txt(r.properties["Rest"]),
        warmup: sel(r.properties["Warm-up"]),
        markerLift: check(r.properties["Marker Lift"]),
        coachNote: txt(r.properties["Coach note (exercise)"]),
        cueText: roll(r.properties["Cue text"]),
        lastWeight: last[name]?.weight ?? null,
        lastReps: last[name]?.reps ?? "",
        weight: num(r.properties["Weight (kg)"]),
        reps: txt(r.properties["Reps Done"]),
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
      const hasWeight = e.weight !== null && e.weight !== undefined && e.weight !== "";
      const hasReps = typeof e.reps === "string" && e.reps.trim() !== "";
      const hasNote = typeof e.note === "string" && e.note.trim() !== "";
      if (!hasWeight && !hasReps && !hasNote) continue;

      const props: any = {};
      if (hasWeight) props["Weight (kg)"] = { number: Number(e.weight) };
      if (hasReps) props["Reps Done"] = { rich_text: [{ text: { content: e.reps } }] };
      if (hasNote)
        props["My note (exercise)"] = { rich_text: [{ text: { content: e.note } }] };

      await updatePage(e.id, props);
      written++;
      await new Promise((r) => setTimeout(r, 350));
    }

    return NextResponse.json({ ok: true, written });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
