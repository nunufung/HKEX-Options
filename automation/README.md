# Morning brief automation

Powers a weekday morning brief (calendar + market news + options that need attention),
run automatically via a Claude Code **Routine** (claude.ai/code/routines). A routine can't
be created from inside a Claude Code on the web session, so the last step below has to be
done by you, once, in the browser.

## What's here

- `positions.json` — your real open option positions. Empty by default; keep it updated.
- `check-positions.ts` — reads `positions.json` and flags positions by days-to-expiry,
  reusing the same `calculateDTE` logic and `dteThreshold` (21 days) the app's
  DecisionEngine already uses. Run it with `npm run check-positions`.

This script only checks expiry timing — it has no live market data (no brokerage feed is
wired up; see `.env.example`'s Futu OpenAPI note). The routine prompt below fills that gap
by web-searching current prices/news for whatever tickers are in `positions.json`.

## Maintaining `positions.json`

Array of objects with this shape:

```json
{
  "id": "1",
  "symbol": "700",
  "name": "Tencent",
  "type": "Short Put",
  "strike": 380,
  "expiry": "2026-07-31",
  "contracts": 1,
  "entryPrice": 4.5,
  "margin": 8000,
  "notes": "optional free text"
}
```

Required: `id`, `symbol`, `type` (`Short Put` | `Short Call` | `Covered Call` | `Long Put`),
`strike`, `expiry` (`YYYY-MM-DD`). Everything else is optional context shown in the brief.
Remove an entry once you've closed the position.

If this repository is public, note that this file will expose your real strikes, expiries,
and entry prices — keep the repo private, or move this file to a private source instead.

## One-time setup: create the routine

1. Go to [claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**.
2. **Repository**: add this repo (`nunufung/HKEX-Options`).
3. **Environment**: Default is fine. Optionally set its setup script to `npm install` so
   dependencies are cached instead of reinstalled on every run.
4. **Connectors**: keep Google Calendar enabled (remove ones this routine doesn't need,
   e.g. Canva/Drive, since included connectors get unprompted write access during runs).
5. **Trigger**: Schedule → Weekdays → pick your preferred morning time (local time, converts
   automatically).
6. **Prompt**: paste the block below as-is.
7. Create, then click **Run now** once to confirm it works before trusting the schedule.

### Routine prompt

```
Generate my weekday morning brief as a single Markdown report with exactly these three
sections, in order: "Calendar", "Market & Stock News", and "Options — Needs Attention".
Use concise bullet points. If a section has nothing to report, keep its heading and write
"Nothing to report."

1. Calendar
Using the Google Calendar connector, list today's events (Asia/Hong_Kong timezone) with
start time and title, in chronological order. If the calendar connector isn't available or
returns an error, say so plainly rather than guessing.

2. Market & Stock News
Run `cat automation/positions.json` in this repo to see which HKEX tickers I currently hold
options on. Web-search for: (a) today's overall Hang Seng Index / Hong Kong market
headlines, and (b) company-specific news from the last 24-48 hours for each ticker found in
positions.json. Only include items likely to move the stock or affect an open option
position (earnings, guidance, regulatory action, large price moves, analyst rating changes)
— skip routine noise. Cite sources as links.

3. Options — Needs Attention
Run `npm run check-positions` in this repo and include every line it prints. That script
only flags positions by days-to-expiry; it has no live market data. For every position it
lists, web-search the underlying ticker's current share price and flag if the strike is now
at-the-money or in-the-money (assignment/exercise risk) given the position type (Short
Put/Short Call/Covered Call/Long Put). If positions.json is empty, say there are no tracked
positions and remind me to add entries there.

End the brief with one "Top priority" line naming the single most urgent item across all
three sections, or "Nothing urgent today" if there isn't one.
```

## Limitations

- No brokerage feed: position P/L and live option Greeks aren't tracked, only expiry timing
  plus a live underlying-price sanity check via web search.
- Calendar requires the Google Calendar connector to stay linked on your claude.ai account.
- You're on the hook for keeping `positions.json` in sync with what you actually hold.
