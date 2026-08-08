import { NextResponse } from "next/server";
import {
  queryDb, updatePage, num, txt, title, sel, multi, check, roll,
  today, daysBefore, toNum, wMulti, NotionError, SEP,
  databaseProps, ALIASES, pickName,
} from "@/lib/notion";

const DB = process.env.NOTION_TRAINING_DB!;
export const dynamic = "force-dynamic";
/* Sequential writes plus a read-back. Default 10s was not enough headroom. */
export const maxDuration = 60;

/* ------------------------------------------------------------------ *
 * FIELD OWNERSHIP. The app writes only what Vee performed:
 *     Weight (kg) · Reps Done · RIR · My note (exercise) · Machine / variation
 * Everything else on the row is the coach's, and is read-only here:
 *     Target · Target reps · Rec weight (kg) · Coach note (exercise) ·
 *     Rest · Warm-up · Marker Lift · Order · Day · Session Date · Plan
 * ------------------------------------------------------------------ */

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

    /* One query for history, not one per exercise — Notion rate-limits ~3 req/sec.
       Guarded: a row with an empty Day select would 400 the whole request. */
    let history: any = { results: [] };
    if (day) {
      history = await queryDb(DB, {
        filter: {
          and: [
            { property: "Day", select: { equals: day } },
            { property: "Session Date", date: { on_or_after: daysBefore(d, 60) } },
            { property: "Session Date", date: { before: d } },
          ],
        },
        sorts: [{ property: "Session Date", direction: "descending" }],
        page_size: 100,
      });
    }

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

        /* Target is the coach's prose and is shown whole. It used to be split
           on the em-dash to guess rep counts, which mangled longer notes and
           made the number of set rows depend on punctuation. Target reps is a
           real field in the database — use it. */
        target: txt(r.properties["Target"]),
        targetReps: txt(r.properties["Target reps"]) || txt(r.properties["Rec reps"]),

        recWeight: num(r.properties["Rec weight (kg)"]),
        rest: txt(r.properties["Rest"]),
        warmup: sel(r.properties["Warm-up"]),
        markerLift: check(r.properties["Marker Lift"]),
        coachNote: txt(r.properties["Coach note (exercise)"]),
        targetRir: txt(r.properties["Target RIR"]),
        cueText: roll(r.properties["Cue text"]),
        lastWeight: last[name]?.weight ?? null,
        lastReps: last[name]?.reps ?? "",
        lastRir: last[name]?.rir ?? "",
        weight: num(r.properties["Weight (kg)"]),
        reps: txt(r.properties["Reps Done"]),
        rir: txt(r.properties["RIR"]),
        myNote: ALIASES.athleteNote
          .map((n) => txt(r.properties[n]))
          .find(Boolean) ?? "",
      };
    });

    return NextResponse.json({ day, date: d, exercises });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* Build the properties patch for one exercise. Returns null when there is
   nothing the athlete actually did — an untouched card must never be written. */
function buildProps(e: any, noteField: string | null) {
  const props: any = {};

  const sets = (e.sets ?? []).filter(
    (s: any) =>
      String(s.weight ?? "").trim() !== "" ||
      String(s.reps ?? "").trim() !== "" ||
      String(s.rir ?? "").trim() !== ""
  );

  /* Reps are the proof a set happened. A weight on its own — including a
     prefilled recommendation she never lifted — is not a logged set. */
  const performed = sets.filter((s: any) => String(s.reps ?? "").trim() !== "");

  if (performed.length) {
    const ws = performed.map((s: any) => toNum(s.weight));
    const known = ws.filter((n: number | null): n is number => n != null);
    const uniform = known.length === performed.length && new Set(known).size === 1;

    /* One entry per set, "/" separated — the house format. Target reps and RIR
       already use it, as does every hand-typed row, so a set's target, its
       result and its RIR line up position by position:
           Target reps  10/10/10
           Reps Done    10/9/9
           RIR          1/1/0
       Varied load carries the weight inline: 70x10/60x10/60x8. */
    const line = uniform
      ? performed.map((s: any) => String(s.reps).trim()).join(SEP)
      : performed
          .map((s: any, i: number) => {
            const w = ws[i];
            const r = String(s.reps).trim();
            return w != null ? `${w}x${r}` : r;
          })
          .join(SEP);

    if (line) props["Reps Done"] = { rich_text: [{ text: { content: line } }] };
    if (known.length) props["Weight (kg)"] = { number: Math.max(...known) };

    const rirLine = performed
      .map((s: any) => String(s.rir ?? "").trim())
      .join("/")
      .replace(/^\/+|\/+$/g, "");
    if (rirLine.replace(/\//g, "")) {
      props["RIR"] = { rich_text: [{ text: { content: rirLine } }] };
    }
  }

  /* Renamed from "My note (exercise)" to "Athlete's note (exercise)" on
     8 Aug 2026. noteField is resolved against the live schema, so the app
     follows the rename instead of failing the whole row. */
  if (noteField && typeof e.note === "string" && e.note.trim() !== "")
    props[noteField] = { rich_text: [{ text: { content: e.note.trim() } }] };

  /* Only when she actually opened the picker and changed it. Previously this
     was written on every row every time, so no card was ever "untouched". */
  if (e.variationChanged && Array.isArray(e.variation))
    props["Machine / variation"] = wMulti(e.variation);

  return Object.keys(props).length ? props : null;
}

export async function POST(req: Request) {
  try {
    const { entries, date } = await req.json();
    const d: string = date || today();

    const saved: any[] = [];
    const skipped: any[] = [];
    const failed: any[] = [];
    const dropped = new Set<string>();

    /* Resolve names against the live schema once. A property Notion does not
       know about fails the whole PATCH, so an upstream rename must not be
       allowed to take the session down with it. */
    const known = await databaseProps(DB);
    const noteField = pickName(known, ALIASES.athleteNote);
    if (!noteField) dropped.add(ALIASES.athleteNote[0]);

    for (const e of entries ?? []) {
      const props = buildProps(e, noteField);
      if (props) {
        for (const k of Object.keys(props)) {
          if (!known.has(k)) {
            delete props[k];
            dropped.add(k);
          }
        }
      }
      if (!props || Object.keys(props).length === 0) {
        skipped.push({ id: e.id, name: e.name ?? "" });
        continue;
      }
      try {
        await updatePage(e.id, props);
        saved.push({ id: e.id, name: e.name ?? "" });
      } catch (err: any) {
        failed.push({
          id: e.id,
          name: e.name ?? "",
          error: err instanceof NotionError ? `${err.status}` : String(err.message ?? err),
        });
      }
      await new Promise((r) => setTimeout(r, 320));
    }

    /* Read back what is actually in Notion now. The app must never again
       report success on the strength of its own intentions. */
    let verified: any[] = [];
    let verifyError: string | null = null;
    if (saved.length) {
      try {
        const check = await queryDb(DB, {
          filter: { property: "Session Date", date: { equals: d } },
          sorts: [{ property: "Order", direction: "ascending" }],
          page_size: 100,
        });
        const byId = new Map(
          (check.results as any[]).map((r) => [r.id.replace(/-/g, ""), r])
        );
        verified = saved.map((s) => {
          const r = byId.get(String(s.id).replace(/-/g, ""));
          return {
            id: s.id,
            name: s.name,
            weight: r ? num(r.properties["Weight (kg)"]) : null,
            reps: r ? txt(r.properties["Reps Done"]) : "",
            rir: r ? txt(r.properties["RIR"]) : "",
            present: !!r,
          };
        });
      } catch (err: any) {
        verifyError = err.message;
      }
    }

    const landed = verified.filter((v) => v.present && (v.reps || v.weight != null));

    return NextResponse.json({
      ok:
        failed.length === 0 &&
        saved.length > 0 &&
        landed.length === saved.length &&
        dropped.size === 0,
      date: d,
      saved: saved.length,
      skipped: skipped.map((s) => s.name).filter(Boolean),
      failed,
      verified,
      verifyError,
      /* Properties the database no longer has. Surfaced loudly: it means
         someone renamed a field the app writes to. */
      dropped: Array.from(dropped),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
