import "dotenv/config";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import { getCompanyNews } from "./finnhub.js";
import { getDailyBars } from "./massive.js";
import { getOverview } from "./overview.js";
import {
  initWatchlist,
  listWatchlist,
  addSymbol,
  removeSymbol,
  getHistory,
  isWatched,
} from "./watchlist.js";

const CANDLE_RANGES = new Set(["1W", "1M", "6M", "1Y"]);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/login", (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== "string" || password !== process.env.password) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + SESSION_MS);
  res.json({ token });
});

app.use("/api", (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const expiry = token && sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
});

app.get("/api/watchlist", (req, res) => {
  res.json(listWatchlist());
});

app.post("/api/watchlist", async (req, res) => {
  try {
    const { symbol } = req.body;
    const updated = await addSymbol(symbol ?? "");
    res.status(201).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/watchlist/:symbol", async (req, res) => {
  const updated = await removeSymbol(req.params.symbol);
  res.json(updated);
});

app.get("/api/stocks/:symbol/history", (req, res) => {
  if (!isWatched(req.params.symbol)) {
    return res.status(404).json({ error: "Symbol is not on the watchlist" });
  }
  res.json(getHistory(req.params.symbol));
});

app.get("/api/stocks/:symbol/candles", async (req, res) => {
  if (!isWatched(req.params.symbol)) {
    return res.status(404).json({ error: "Symbol is not on the watchlist" });
  }
  const range = req.query.range;
  if (!CANDLE_RANGES.has(range)) {
    return res.status(400).json({ error: "range must be one of 1W, 1M, 6M, 1Y" });
  }
  try {
    const bars = await getDailyBars(req.params.symbol.toUpperCase(), range);
    res.json(bars);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/stocks/:symbol/news", async (req, res) => {
  try {
    const news = await getCompanyNews(req.params.symbol.toUpperCase());
    const trimmed = news
      .slice(0, 20)
      .map(({ headline, source, url, datetime, summary }) => ({
        headline,
        source,
        url,
        datetime,
        summary,
      }));
    res.json(trimmed);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/stocks/:symbol/overview", async (req, res) => {
  if (!isWatched(req.params.symbol)) {
    return res.status(404).json({ error: "Symbol is not on the watchlist" });
  }
  try {
    const force = req.query.force === "true";
    const data = await getOverview(req.params.symbol.toUpperCase(), { force });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

initWatchlist()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Stock dashboard API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
