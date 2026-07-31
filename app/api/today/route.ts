import { NextResponse } from "next/server";
import {
  queryDb, num, txt, sel, multi, check, dat, formula, today,
} from "@/lib/notion";

const TRAIN = process.env.NOTION_TRAINING_DB!;
const DAILY = process.env.NOTION_DAILY_DB!;
export const dynamic = "force-dynamic";

const S = (v: number | null) => (v == null ? "" : String(v));

export async function GET(req: Request) {
  try {
    const d = new URL(req.url).searchParams.get("date") || today();

    const [session, daily] = await Promise.all([
      queryDb(TRAIN, {
        filter: { property: "Session Date", date: { equals: d } },
        sorts: [{ property: "Order", direction: "ascending" }],
      }),
      queryDb(DAILY, { filter: { property: "Day Date", date: { equals: d } } }),
    ]);

    const row = daily.results[0] as any;
    const p = row?.properties;

    return NextResponse.json({
      date: d,
      isToday: d === today(),
      day: session.results.length
        ? sel((session.results[0] as any).properties["Day"])
        : null,
      exerciseCount: session.results.length,
      exists: !!row,
      cycleDay: p ? formula(p["Cycle day"]) : "",
      phase: p ? formula(p["Phase (v2)"]) || formula(p["Phase (auto)"]) : "",
      daily: p
        ? {
            weight: S(num(p["Body weight (kg)"])),
            bodyFat: S(num(p["Body fat %"])),
            waist: S(num(p["Waist (in)"])),
            calories: S(num(p["Calories"])),
            protein: S(num(p["Protein (g)"])),
            carbs: S(num(p["Carbs (g)"])),
            fat: S(num(p["Fat (g)"])),
            fibre: S(num(p["Fibre (g)"])),
            satFat: S(num(p["Sat fat (g)"])),
            water: S(num(p["Water (L)"])),
            steps: S(num(p["Steps"])),
            intensityMins: S(num(p["Intensity mins"])),
            otherCardio: multi(p["Other cardio"]),
            sleep: S(num(p["Sleep (h)"])),
            restingHR: S(num(p["Resting HR"])),
            bpSys: S(num(p["BP SYS"])),
            bpDia: S(num(p["BP DIA"])),
            bpPulse: S(num(p["BP Pulse"])),
            elvanse: S(num(p["Elvanse (mg)"])),
            reta: S(num(p["Reta Dose (mg)"])),
            tableSalt: S(num(p["Table salt (g)"])),
            loSalt: S(num(p["LoSalt (g)"])),
            goal: sel(p["Goal"]),
            discharge: sel(p["Discharge"]),
            libido: sel(p["Libido"]),
            periodStart: dat(p["Period start"]),
            meds: multi(p["Prescription meds"]),
            supps: multi(p["Supplements taken"]),
            cramps: check(p["Cramps"]),
            bloating: check(p["Bloating"]),
            breastTenderness: check(p["Breast tenderness"]),
            moodShift: check(p["Mood shift"]),
            twGut: check(p["TW: Gut flare"]),
            twJoint: check(p["TW: Joint/flare"]),
            twEnergy: check(p["TW: Low energy/dread"]),
            twSleep: check(p["TW: Poor sleep"]),
            sxDizziness: check(p["Sx: Dizziness"]),
            sxHeadache: check(p["Sx: Headache"]),
            sxPalpitations: check(p["Sx: Palpitations"]),
            sxOther: check(p["Sx: Other"]),
            dietNotes: txt(p["Diet notes"]),
            notes: txt(p["Notes (flare/joint/gut/energy)"]),
            coachNote: txt(p["Coach note"]),
          }
        : {
            weight: "", bodyFat: "", waist: "", calories: "", protein: "", carbs: "",
            fat: "", fibre: "", satFat: "", water: "", steps: "", intensityMins: "",
            otherCardio: [], sleep: "", restingHR: "", bpSys: "", bpDia: "",
            bpPulse: "", elvanse: "", reta: "", tableSalt: "", loSalt: "", goal: null,
            discharge: null, libido: null, periodStart: null, meds: [], supps: [],
            cramps: false, bloating: false, breastTenderness: false, moodShift: false,
            twGut: false, twJoint: false, twEnergy: false, twSleep: false,
            sxDizziness: false, sxHeadache: false, sxPalpitations: false,
            sxOther: false, dietNotes: "", notes: "", coachNote: "",
          },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
