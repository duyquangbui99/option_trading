const BASE_URL = "https://finnhub.io/api/v1";

function apiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set (see backend/.env.example)");
  return key;
}

async function finnhubGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", apiKey());

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getQuote(symbol) {
  return finnhubGet("/quote", { symbol });
}

export async function symbolExists(symbol) {
  const quote = await getQuote(symbol);
  // Finnhub returns all-zero fields for unknown symbols instead of an error.
  return quote.c !== 0 || quote.pc !== 0;
}

export function getCompanyProfile(symbol) {
  return finnhubGet("/stock/profile2", { symbol });
}

export function getCompanyNews(symbol, { days = 7 } = {}) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return finnhubGet("/company-news", { symbol, from: fmt(from), to: fmt(to) });
}
