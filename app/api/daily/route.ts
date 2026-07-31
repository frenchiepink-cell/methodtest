import { NextResponse } from "next/server";
import {
  queryDb, updatePage, createPage, today,
  wNum, wTxt, wCheck, wSel, wMulti, wDate,
} from "@/lib/notion";

const DAILY = process.env.NOTION_DAILY_DB!;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const d: string = body.date || today();
    const v = body.daily ?? {};

    const props: any = {
      "Body weight (kg)": wNum(v.weight),
      "Body fat %": wNum(v.bodyFat),
      "Waist (in)": wNum(v.waist),
      "Calories": wNum(v.calories),
      "Protein (g)": wNum(v.protein),
      "Carbs (g)": wNum(v.carbs),
      "Fat (g)": wNum(v.fat),
      "Fibre (g)": wNum(v.fibre),
      "Sat fat (g)": wNum(v.satFat),
      "Water (L)": wNum(v.water),
      "Steps": wNum(v.steps),
      "Intensity mins": wNum(v.intensityMins),
      "Other cardio": wMulti(v.otherCardio),
      "Sleep (h)": wNum(v.sleep),
      "Resting HR": wNum(v.restingHR),
      "BP SYS": wNum(v.bpSys),
      "BP DIA": wNum(v.bpDia),
      "BP Pulse": wNum(v.bpPulse),
      "Elvanse (mg)": wNum(v.elvanse),
      "Reta Dose (mg)": wNum(v.reta),
      "Table salt (g)": wNum(v.tableSalt),
      "LoSalt (g)": wNum(v.loSalt),
      "Goal": wSel(v.goal),
      "Discharge": wSel(v.discharge),
      "Libido": wSel(v.libido),
      "Period start": wDate(v.periodStart),
      "Prescription meds": wMulti(v.meds),
      "Supplements taken": wMulti(v.supps),
      "Cramps": wCheck(v.cramps),
      "Bloating": wCheck(v.bloating),
      "Breast tenderness": wCheck(v.breastTenderness),
      "Mood shift": wCheck(v.moodShift),
      "TW: Gut flare": wCheck(v.twGut),
      "TW: Joint/flare": wCheck(v.twJoint),
      "TW: Low energy/dread": wCheck(v.twEnergy),
      "TW: Poor sleep": wCheck(v.twSleep),
      "Sx: Dizziness": wCheck(v.sxDizziness),
      "Sx: Headache": wCheck(v.sxHeadache),
      "Sx: Palpitations": wCheck(v.sxPalpitations),
      "Sx: Other": wCheck(v.sxOther),
      "Diet notes": wTxt(v.dietNotes),
      "Notes (flare/joint/gut/energy)": wTxt(v.notes),
    };

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
