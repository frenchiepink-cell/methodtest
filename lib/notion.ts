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
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${await res.text()}`);
  }
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

/* Notion property readers. These shapes are fiddly — keep them in one place. */
export const num = (p: any): number | null => p?.number ?? null;
export const txt = (p: any): string =>
  p?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
export const title = (p: any): string =>
  p?.title?.map((t: any) => t.plain_text).join("") ?? "";
export const sel = (p: any): string | null => p?.select?.name ?? null;
export const multi = (p: any): string[] =>
  p?.multi_select?.map((s: any) => s.name) ?? [];
export const check = (p: any): boolean => p?.checkbox ?? false;
export const roll = (p: any): string => {
  const arr = p?.rollup?.array ?? [];
  return arr
    .map((a: any) => (a?.type === "rich_text" ? txt(a) : a?.type === "title" ? title(a) : ""))
    .filter(Boolean)
    .join(" · ");
};

/* Local date, not UTC — a 23:30 gym session must not land on tomorrow. */
export function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export type Exercise = {
  id: string;
  name: string;
  variation: string[];
  order: number | null;
  target: string;
  recWeight: number | null;
  rest: string;
  warmup: string | null;
  markerLift: boolean;
  coachNote: string;
  cueText: string;
  lastWeight: number | null;
  lastReps: string;
  weight: number | null;
  reps: string;
};
