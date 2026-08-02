import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getQuote, getCompanyProfile } from "./finnhub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

const POLL_INTERVAL_MS = 15_000;
const MAX_HISTORY_POINTS = 200;

let entries = []; // [{symbol, addedAt}]
const history = new Map(); // symbol -> [{time, price}]
const latestQuote = new Map(); // symbol -> finnhub quote response
const companyName = new Map(); // symbol -> company name, fetched once (doesn't change)
let pollTimer = null;

async function fetchCompanyName(symbol) {
  if (companyName.has(symbol)) return;
  try {
    const profile = await getCompanyProfile(symbol);
    companyName.set(symbol, profile?.name || null);
  } catch (err) {
    console.error(`[watchlist] failed to fetch profile for ${symbol}:`, err.message);
  }
}

async function persist() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(WATCHLIST_FILE, JSON.stringify(entries, null, 2));
}

async function load() {
  try {
    const raw = await readFile(WATCHLIST_FILE, "utf-8");
    entries = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    entries = [];
  }
}

function trend(quote) {
  if (!quote || quote.pc === 0) return "flat";
  if (quote.c > quote.pc) return "up";
  if (quote.c < quote.pc) return "down";
  return "flat";
}

async function pollSymbol(symbol) {
  try {
    const quote = await getQuote(symbol);
    latestQuote.set(symbol, quote);
    await fetchCompanyName(symbol);

    const series = history.get(symbol) ?? [];
    series.push({ time: Date.now(), price: quote.c });
    if (series.length > MAX_HISTORY_POINTS) series.shift();
    history.set(symbol, series);
  } catch (err) {
    console.error(`[watchlist] failed to poll ${symbol}:`, err.message);
  }
}

async function pollAll() {
  await Promise.all(entries.map((e) => pollSymbol(e.symbol)));
}

function startPolling() {
  if (pollTimer) return;
  pollAll(); // kick off immediately so new entries don't wait a full interval
  pollTimer = setInterval(pollAll, POLL_INTERVAL_MS);
}

export async function initWatchlist() {
  await load();
  startPolling();
}

export function listWatchlist() {
  return entries.map((e) => {
    const quote = latestQuote.get(e.symbol);
    return {
      symbol: e.symbol,
      name: companyName.get(e.symbol) ?? null,
      addedAt: e.addedAt,
      price: quote?.c ?? null,
      change: quote?.d ?? null,
      percentChange: quote?.dp ?? null,
      open: quote?.o ?? null,
      high: quote?.h ?? null,
      low: quote?.l ?? null,
      trend: trend(quote),
    };
  });
}

export async function addSymbol(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required");
  if (entries.some((e) => e.symbol === symbol)) {
    throw new Error(`${symbol} is already on the watchlist`);
  }

  const quote = await getQuote(symbol);
  if (quote.c === 0 && quote.pc === 0) {
    throw new Error(`${symbol} doesn't look like a valid ticker`);
  }

  entries.push({ symbol, addedAt: new Date().toISOString() });
  await persist();
  await pollSymbol(symbol);
  return listWatchlist();
}

export async function removeSymbol(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  entries = entries.filter((e) => e.symbol !== symbol);
  history.delete(symbol);
  latestQuote.delete(symbol);
  companyName.delete(symbol);
  await persist();
  return listWatchlist();
}

export function getHistory(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  return history.get(symbol) ?? [];
}

export function isWatched(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  return entries.some((e) => e.symbol === symbol);
}
