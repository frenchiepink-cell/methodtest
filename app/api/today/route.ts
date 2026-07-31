import { NextResponse } from "next/server";
import { queryDb, num, txt, sel, today } from "@/lib/notion";

const TRAIN = process.env.NOTION_TRAINING_DB!;
const DAILY = process.env.NOTION_DAILY_DB!;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const d = today();
    const [session, daily] = await Promise.all([
      queryDb(TRAIN, {
        filter: { property: "Session Date", date: { equals: d } },
        sorts: [{ property: "Order", direction: "ascending" }],
      }),
      queryDb(DAILY, { filter: { property: "Day Date", date: { equals: d } } }),
    ]);

    const p = (daily.results[0] as any)?.properties;

    return NextResponse.json({
      date: d,
      day: session.results.length
        ? sel((session.results[0] as any).properties["Day"])
        : null,
      exerciseCount: session.results.length,
      daily: p
        ? {
            weight: num(p["Body weight (kg)"]),
            steps: num(p["Steps"]),
            sleep: num(p["Sleep (h)"]),
            calories: num(p["Calories"]),
            dietNotes: txt(p["Diet notes"]),
          }
        : { weight: null, steps: null, sleep: null, calories: null, dietNotes: "" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
