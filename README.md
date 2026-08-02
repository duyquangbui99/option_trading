# Stock Dashboard

A simple dashboard to track stocks: add a ticker, watch its live price and trend,
chart it as data comes in, and pull its latest news on demand.

## Stack

- **Backend**: Node.js + Express, proxying [Finnhub](https://finnhub.io) for quotes and news.
- **Frontend**: React (Vite) + Recharts.
- Watchlist persists to `backend/data/watchlist.json`. Price history is in-memory
  (rebuilds each time the backend restarts) — the chart is powered by polling the
  live quote every 15s rather than a historical-candle API, since Finnhub's
  historical OHLC endpoint is gated behind a paid plan for US equities.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register).
2. Copy the backend env template and add your key:
   ```
   cp backend/.env.example backend/.env
   ```
   Then edit `backend/.env` and set `FINNHUB_API_KEY`.
3. Install everything:
   ```
   npm run install:all
   ```
4. Start both servers:
   ```
   npm run dev
   ```
   Backend runs on http://localhost:4000, frontend on Vite's dev server
   (usually http://localhost:5173).

## Overview (AI summary)

The stock detail page includes an "Overview" card with an AI-generated summary
(key facts, recent trend, and catalysts/risks) aimed at short-term/options
traders. Rather than call a paid LLM API, the backend shells out to the
[Claude Code CLI](https://github.com/anthropics/claude-code) in headless mode
(`claude -p "<prompt>"`) per request, which reuses your existing Claude.ai/
Console login — no separate Anthropic API key required.

Setup:
1. Install the CLI globally: `npm install -g @anthropic-ai/claude-code`
2. Log in once: `claude login`
3. Sanity-check it works: `claude -p "say hello in 3 words"` should print
   text and exit. (Flags shown here are Claude Code's commonly documented
   headless/print mode — run `claude --help` if this doesn't behave as
   expected, since exact flags can change between CLI versions.)

Overviews are cached per symbol for 15 minutes (the "Refresh" button bypasses
the cache) since each generation takes real CLI/model time. If the `claude`
binary isn't installed, isn't logged in, or the call times out, the card shows
a clear error instead of crashing the backend.

## Notes

- Finnhub's free tier is rate-limited to 60 requests/minute — the backend polls
  each watchlisted symbol's quote every 15s, which comfortably fits a handful of
  stocks. Add more headroom by raising `POLL_INTERVAL_MS` in `backend/watchlist.js`
  if you watch a lot of tickers.
- News is fetched on demand (button click), not polled, to avoid burning rate
  limit on news nobody's viewing.
