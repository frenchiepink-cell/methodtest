const TOKEN = process.env.NOTION_TOKEN!;
const VERSION = "2022-06-28";

/* The athlete's wall-clock zone. Vercel runs the server in UTC, so this can
   never be derived from the server's own clock — see localDate() below. */
const TZ = process.env.APP_TIMEZONE || "Europe/London";

export class NotionError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Notion ${status}: ${detail}`);
  }
}

async function notion(path: string, init?: RequestInit, attempt = 0): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  /* Notion rate-limits at ~3 req/sec and answers 429 with Retry-After. */
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get("Retry-After") || 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return notion(path, init, attempt + 1);
  }

  if (!res.ok) throw new NotionError(res.status, await res.text());
  return res.json();
}

/* The live property list. Notion rejects an entire PATCH if it mentions one
   unknown property, so a single rename upstream would fail every row in a
   session. Fetch the schema and drop unknown keys instead — a renamed field
   then costs one field, visibly, rather than the whole write silently. */
export const databaseProps = async (db: string): Promise<Set<string>> => {
  const d = await notion(`/databases/${db}`);
  return new Set(Object.keys(d?.properties ?? {}));
};

/* Property names Coach 2.0 has renamed, newest first. The app follows the
   rename rather than breaking; add to the front when it happens again. */
export const ALIASES: Record<string, string[]> = {
  athleteNote: ["Athlete's note (exercise)", "Athlete note (exercise)", "My note (exercise)"],
};

export const pickName = (known: Set<string>, candidates: string[]): string | null =>
  candidates.find((c) => known.has(c)) ?? null;

export const queryDb = (db: string, body: unknown) =>
  notion(`/databases/${db}/query`, { method: "POST", body: JSON.stringify(body) });

export const updatePage = (id: string, properties: unknown) =>
  notion(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ properties }) });

export const createPage = (db: string, properties: unknown) =>
  notion(`/pages`, {
    method: "POST",
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });

/* ---------- readers ---------- */
export const num = (p: any): number | null => p?.number ?? null;
export const txt = (p: any): string =>
  p?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
export const title = (p: any): string =>
  p?.title?.map((t: any) => t.plain_text).join("") ?? "";
export const sel = (p: any): string | null => p?.select?.name ?? null;
export const multi = (p: any): string[] =>
  p?.multi_select?.map((s: any) => s.name) ?? [];
export const check = (p: any): boolean => p?.checkbox ?? false;
export const dat = (p: any): string | null => p?.date?.start ?? null;
export const formula = (p: any): string => {
  const f = p?.formula;
  if (!f) return "";
  if (f.type === "string") return f.string ?? "";
  if (f.type === "number") return f.number != null ? String(f.number) : "";
  if (f.type === "boolean") return f.boolean ? "yes" : "no";
  if (f.type === "date") return f.date?.start ?? "";
  return "";
};
export const roll = (p: any): string => {
  const arr = p?.rollup?.array ?? [];
  return arr
    .map((a: any) =>
      a?.type === "rich_text" ? txt(a) : a?.type === "title" ? title(a) : ""
    )
    .filter(Boolean)
    .join(" · ");
};

/* ---------- writers ---------- */
const has = (v: any) => v !== null && v !== undefined && v !== "";
export const wNum = (v: any) => (has(v) ? { number: Number(v) } : { number: null });
export const wTxt = (v: any) => ({
  rich_text: has(v) ? [{ text: { content: String(v).slice(0, 2000) } }] : [],
});
export const wCheck = (v: any) => ({ checkbox: !!v });
export const wSel = (v: any) => (has(v) ? { select: { name: v } } : { select: null });
export const wMulti = (v: any) => ({
  multi_select: Array.isArray(v) ? v.map((n: string) => ({ name: n })) : [],
});
export const wDate = (v: any) => (has(v) ? { date: { start: v } } : { date: null });

/* "" -> null, not 0. Number("") is 0 and Number.isFinite(0) is true, which is
   how an untouched weight box used to land in Notion as a logged 0kg lift. */
export const toNum = (v: any): number | null => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* ---------- per-set formatting ----------
   House separator for anything recorded per set. Target reps, RIR and every
   hand-typed row use "/", so a set's target, result and RIR line up position
   by position. Reading stays tolerant of the commas the app emitted before
   8 Aug 2026, so older rows still parse. */
export const SEP = "/";
export const splitSets = (s: string): string[] =>
  (s || "").split(/[\/,]/).map((x) => x.trim()).filter(Boolean);

/* ---------- dates ----------
   Must not use getTimezoneOffset(): on Vercel the server clock is UTC, so the
   old version made today() disagree with the phone between 00:00 and 01:00 BST.
   Intl pins it to the athlete's zone on both server and client. */
export function localDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export const today = () => localDate();

/* Pure string arithmetic — no Date-in-local-zone round trip to get wrong. */
export const shiftDate = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return [
    t.getUTCFullYear(),
    String(t.getUTCMonth() + 1).padStart(2, "0"),
    String(t.getUTCDate()).padStart(2, "0"),
  ].join("-");
};
export const daysBefore = (iso: string, n: number) => shiftDate(iso, -n);
