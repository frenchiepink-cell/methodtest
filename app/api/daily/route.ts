import { NextResponse } from "next/server";
import { queryDb, updatePage, createPage, today } from "@/lib/notion";

const DAILY = process.env.NOTION_DAILY_DB!;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { weight, steps, sleep, calories, dietNotes } = await req.json();
    const d = today();

    const set = (v: any) => v !== null && v !== undefined && v !== "";
    const props: any = {};
    if (set(weight)) props["Body weight (kg)"] = { number: Number(weight) };
    if (set(steps)) props["Steps"] = { number: Number(steps) };
    if (set(sleep)) props["Sleep (h)"] = { number: Number(sleep) };
    if (set(calories)) props["Calories"] = { number: Number(calories) };
    if (set(dietNotes))
      props["Diet notes"] = { rich_text: [{ text: { content: dietNotes } }] };

    const existing = await queryDb(DAILY, {
      filter: { property: "Day Date", date: { equals: d } },
    });

    if (existing.results.length) {
      await updatePage((existing.results[0] as any).id, props);
    } else {
      props["Date"] = { title: [{ text: { content: d } }] };
      props["Day Date"] = { date: { start: d } };
      await createPage(DAILY, props);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
