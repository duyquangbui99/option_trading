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

## Notes

- Finnhub's free tier is rate-limited to 60 requests/minute — the backend polls
  each watchlisted symbol's quote every 15s, which comfortably fits a handful of
  stocks. Add more headroom by raising `POLL_INTERVAL_MS` in `backend/watchlist.js`
  if you watch a lot of tickers.
- News is fetched on demand (button click), not polled, to avoid burning rate
  limit on news nobody's viewing.
