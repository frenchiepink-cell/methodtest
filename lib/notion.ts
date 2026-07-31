const TOKEN = process.env.NOTION_TOKEN!;
const VERSION = "2022-06-28";

async function notion(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

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

/* Local date, not UTC — a 23:30 session must not land on tomorrow. */
export function localDate(d = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
export const today = () => localDate();
export const shiftDate = (iso: string, days: number) =>
  localDate(new Date(new Date(iso + "T12:00:00").getTime() + days * 86400000));
export const daysBefore = (iso: string, n: number) => shiftDate(iso, -n);
