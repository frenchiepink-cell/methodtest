# The Method — V0 prototype

Throwaway prototype. A phone-first training logger that reads and writes your existing
Notion databases. Two screens: Today, and Log Session. Nothing else.

## 1. Notion integration (5 minutes)

1. Go to https://notion.so/my-integrations → **New integration**
   - Name: `Method Prototype`, workspace: yours
   - Capabilities: Read content, Update content, Insert content
   - Copy the **Internal Integration Secret** (starts `ntn_`)

2. Share the databases with it. Open each one → `⋯` top right → **Connections** →
   add `Method Prototype`. **All three, or you get 404s that look like code bugs.**
   - Vee · Daily Panel
   - Vee · Training Log
   - Cue Library

## 2. Deploy

Easiest route, no local setup:

1. Create a new empty repo on GitHub.
2. Upload these files to it (GitHub's web uploader is fine — drag the whole folder in,
   excluding `node_modules` and `.next`).
3. Go to vercel.com → **Add New → Project** → import that repo.
4. Before deploying, add four **Environment Variables**:

   | Name | Value |
   |---|---|
   | `NOTION_TOKEN` | your `ntn_…` secret |
   | `NOTION_TRAINING_DB` | `2b11a9968e944d13bb7e929033fb0c48` |
   | `NOTION_DAILY_DB` | `d3278e1f5516496db0074daaf928a978` |
   | `NOTION_CUE_DB` | `ce69873a3dbc444ab38e394da3745af3` |

5. Deploy. Open the URL on your phone and **Add to Home Screen** — it then opens
   full-screen like an app.

Running locally instead: copy `.env.example` to `.env.local`, fill it in,
then `npm install && npm run dev`.

## 3. How it behaves

- **Today** shows what's programmed for today's `Session Date` and lets you enter
  weight, steps, sleep, calories and diet notes into the Daily Panel. If no Daily Panel
  row exists for today it creates one; otherwise it updates.
- **Log Session** lists today's exercises in `Order`, showing last time's weight and reps,
  the target, the rec weight, the coach note, and the cue behind a toggle.
- **Nothing is written until you press Finish.** Everything is held in the browser.
  If the write fails, your entries stay on screen and you can retry.
- Writes go back to `Weight (kg)`, `Reps Done` and `My note (exercise)`.

## 4. Deliberate limits

- Never writes to formulas (`Hit rec?`, `Week`, `Cycle day`, `Phase (auto)`, `Phase (v2)`,
  `BP flag`) or rollups (`Cue text`, `Marker weights`, `Marker reps`). Notion rejects those.
- No photos. Notion file uploads need a different API path and aren't what you're testing.
- No auth. Anyone with the URL can write to your Notion. Keep the URL private, or add
  Vercel password protection.
- Doesn't programme the week. It logs against rows that already exist. No `Session Date`
  for today means an empty state — that's correct.
- Session writes are sequential with a 350ms gap because Notion rate-limits at about
  3 requests a second. An 8-exercise session takes roughly 3 seconds to save. Don't
  remove the delay.

## 5. What you're testing

1. Does seeing "last time" on the card change how you load the bar?
2. Is one row per exercise enough, or do you want per-set entry?
3. Is `Reps done` as free text ("12,10,9") fine, or annoying?
4. Does holding everything until Finish feel safe, or nervy?
5. How often do you actually read the coach note or cue mid-session?
6. What did you reach for that isn't there?
