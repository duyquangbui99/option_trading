const BASE_URL = "https://api.massive.com";

const RANGE_DAYS = { "1W": 7, "1M": 30, "6M": 182, "1Y": 365 };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // EOD bars don't change intraday

const cache = new Map(); // `${symbol}:${range}` -> { at, data }

function apiKey() {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) throw new Error("MASSIVE_API_KEY is not set (see backend/.env.example)");
  return key;
}

const fmt = (d) => d.toISOString().slice(0, 10);

export async function getDailyBars(symbol, range) {
  const days = RANGE_DAYS[range];
  if (!days) throw new Error(`Unknown range: ${range}`);

  const cacheKey = `${symbol}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const url = new URL(`${BASE_URL}/v2/aggs/ticker/${symbol}/range/1/day/${fmt(from)}/${fmt(to)}`);
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("apiKey", apiKey());

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Massive aggregates failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  const data = (body.results ?? []).map((bar) => ({
    time: bar.t,
    price: bar.c,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    volume: bar.v,
  }));

  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}
