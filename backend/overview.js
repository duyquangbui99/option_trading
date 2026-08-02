import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { listWatchlist } from "./watchlist.js";
import { getDailyBars } from "./massive.js";
import { getCompanyNews } from "./finnhub.js";

const execFileAsync = promisify(execFile);

// CLI generation is slow (network + model latency) and this reuses the
// trader's own Claude.ai/Console session rather than a metered API key, so we
// cache aggressively per-symbol rather than per-range. 15 minutes balances
// not re-running a CLI call on every page view against staying fresh enough
// across one trading session. The frontend's "Refresh" button (force=true)
// bypasses this when a fresher take is wanted right before acting.
const CACHE_TTL_MS = 15 * 60 * 1000;

// Headroom beyond typical CLI cold-start + model latency.
const CLI_TIMEOUT_MS = 60_000;

const MAX_BUFFER = 10 * 1024 * 1024;

const NEWS_DAYS = 7;
const MAX_NEWS_ITEMS = 8;

const cache = new Map(); // symbol -> { at, data }
const inflight = new Map(); // symbol -> Promise<data>, dedupes concurrent calls

function pctChange(from, to) {
  if (!from) return null;
  return ((to - from) / from) * 100;
}

// Rough annualized realized volatility from daily closes (std dev of daily
// returns * sqrt(252)). Approximate context for the model's narrative, not a
// precise risk metric.
function realizedVolatility(bars) {
  if (bars.length < 2) return null;
  const returns = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].price;
    if (prev) returns.push((bars[i].price - prev) / prev);
  }
  if (!returns.length) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

const fmtPct = (v) => (v == null ? "not available" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

function buildPrompt({ symbol, quote, oneMonthPct, oneYearPct, vol, news }) {
  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "numeric",
    day: "numeric",
  });

  const newsLines = news
    .slice(0, MAX_NEWS_ITEMS)
    .map((n) => {
      const d = new Date(n.datetime * 1000);
      const dateLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
      return `- [${dateLabel}] ${n.headline} (${n.source})`;
    })
    .join("\n");

  return `You are writing a short, balanced overview of a stock for a retail trader who does short-term / scalp trading and options. Base it only on the data given below plus general knowledge about the company; do not invent specific figures that aren't provided.

Today's date: ${todayLabel}

Stock: ${symbol}
Current price: ${quote.price != null ? `$${quote.price.toFixed(2)}` : "not available"} (${fmtPct(quote.percentChange)} today)
Today's range: ${quote.low != null && quote.high != null ? `$${quote.low.toFixed(2)} - $${quote.high.toFixed(2)}` : "not available"}
1-month price change: ${fmtPct(oneMonthPct)}
1-year price change: ${fmtPct(oneYearPct)}
Approx. annualized realized volatility (from the past month's daily closes): ${vol == null ? "not available" : `${vol.toFixed(1)}%`}

Recent news headlines (last ${NEWS_DAYS} days, most recent first, each tagged with the date it was published):
${newsLines || "- No recent news found."}

Write a plain-text response with exactly these four sections, each starting on its own line with the header text shown (no markdown symbols, no bold, no tables):

KEY FACTS: 2-3 sentences on what the company does and where the stock stands right now.
RECENT TREND: 2-3 sentences on how the price has moved (1-month vs 1-year) and what the volatility figure suggests about how choppy or quiet trading has been.
CATALYSTS: a short bullet list (using "-") of news-driven or likely near-term events that could move the price, drawn from the headlines above.
RISKS TO WATCH: a short bullet list (using "-") of factors that could work against a bullish thesis.

Date rules (apply to CATALYSTS and RISKS TO WATCH):
- Every event you reference must include a specific date written as "Weekday M/D" (e.g. "Tuesday 8/4"), computed relative to today's date given above.
- Never use vague relative time words like "this week," "recently," "upcoming," or "soon" without also giving the concrete date next to them.
- Use the headline's own date for things that already happened. For scheduled future events (e.g. an earnings date) either use the date if it's stated in a headline, or use your general knowledge of the company's actual schedule — only state a specific future date if you're reasonably confident of it, otherwise say "date not confirmed" rather than guessing.

Hard rules:
- Never give an explicit buy, sell, or hold recommendation, a price target, or any directive ("you should...").
- Write neutral, informational commentary that presents both upside and downside possibilities.
- If the provided data is insufficient for a section, say so in one sentence instead of inventing details.
- Keep the entire response under 250 words. Plain text only — no markdown headers, bold, or tables.`;
}

async function runClaudeCli(prompt) {
  try {
    const { stdout } = await execFileAsync("claude", ["-p", prompt], {
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    const text = stdout.replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (!text) throw new Error("Claude CLI returned empty output");
    return text;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        "Claude Code CLI not found. Install it with `npm install -g @anthropic-ai/claude-code`, " +
          "log in with `claude login`, and make sure `claude` is on your PATH, then try again.",
      );
    }
    if (err.killed || err.signal) {
      throw new Error(
        "Generating the overview timed out. The Claude CLI may be slow to respond right now — try refreshing again in a moment.",
      );
    }
    const detail = (err.stderr || err.message || "").toString().trim().slice(0, 500);
    throw new Error(`Claude CLI failed to generate an overview${detail ? `: ${detail}` : ""}`);
  }
}

export async function getOverview(symbol, { force = false } = {}) {
  if (!force) {
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  }
  if (inflight.has(symbol)) return inflight.get(symbol);

  const promise = (async () => {
    try {
      const quote = listWatchlist().find((s) => s.symbol === symbol);
      if (!quote) throw new Error(`${symbol} is not on the watchlist`);

      const [oneMonthBars, oneYearBars, news] = await Promise.all([
        getDailyBars(symbol, "1M"),
        getDailyBars(symbol, "1Y"),
        getCompanyNews(symbol, { days: NEWS_DAYS }),
      ]);

      const oneMonthPct = oneMonthBars.length
        ? pctChange(oneMonthBars[0].price, oneMonthBars[oneMonthBars.length - 1].price)
        : null;
      const oneYearPct = oneYearBars.length
        ? pctChange(oneYearBars[0].price, oneYearBars[oneYearBars.length - 1].price)
        : null;
      const vol = realizedVolatility(oneMonthBars);

      const prompt = buildPrompt({ symbol, quote, oneMonthPct, oneYearPct, vol, news });
      const text = await runClaudeCli(prompt);

      const data = { text, generatedAt: new Date().toISOString() };
      cache.set(symbol, { at: Date.now(), data });
      return data;
    } finally {
      inflight.delete(symbol);
    }
  })();

  inflight.set(symbol, promise);
  return promise;
}
