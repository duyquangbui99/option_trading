import { useEffect, useState } from "react";
import PriceChart from "./PriceChart";
import NewsPanel from "./NewsPanel";
import { getCandles } from "../api";

const RANGES = ["1D", "1W", "1M", "6M", "1Y"];
const RANGE_LABEL = { "1W": "past week", "1M": "past month", "6M": "past 6 months", "1Y": "past year" };

const money = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;
const pctf = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function formatVolume(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export default function StockDetail({ stock, history }) {
  const [range, setRange] = useState("1D");
  const [candles, setCandles] = useState([]);
  const [candlesError, setCandlesError] = useState(null);
  const [scrub, setScrub] = useState(null);
  const { symbol, price, change, percentChange, open, high, low } = stock;

  useEffect(() => {
    setScrub(null);
    if (range === "1D") return;
    let cancelled = false;
    setCandles([]);
    setCandlesError(null);
    getCandles(symbol, range)
      .then((data) => {
        if (!cancelled) setCandles(data);
      })
      .catch((err) => {
        if (!cancelled) setCandlesError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const series = range === "1D" ? history ?? [] : candles;
  const seriesStart = series[0]?.price ?? null;
  const lastPoint = series[series.length - 1] ?? null;

  const rangeDiff = lastPoint && seriesStart != null ? lastPoint.price - seriesStart : null;
  const rangePct = rangeDiff != null && seriesStart ? (rangeDiff / seriesStart) * 100 : null;

  const displayPrice = scrub ? scrub.price : range === "1D" ? price : (lastPoint?.price ?? price);
  const displayDiff = scrub && seriesStart != null ? scrub.price - seriesStart : range === "1D" ? change : rangeDiff;
  const displayPct =
    scrub && seriesStart ? ((scrub.price - seriesStart) / seriesStart) * 100 : range === "1D" ? percentChange : rangePct;
  const positive = (displayDiff ?? 0) >= 0;

  const statOpen = range === "1D" ? open : series[0]?.open ?? null;
  const statHigh = range === "1D" ? high : series.length ? Math.max(...series.map((p) => p.high ?? p.price)) : null;
  const statLow = range === "1D" ? low : series.length ? Math.min(...series.map((p) => p.low ?? p.price)) : null;

  const fourthLabel = range === "1D" ? "Prev close" : "Volume";
  const fourthValue =
    range === "1D"
      ? price != null && change != null
        ? `$${money(price - change)}`
        : "—"
      : series.length
        ? formatVolume(series.reduce((sum, p) => sum + (p.volume ?? 0), 0))
        : "—";

  const scrubLabel = scrub
    ? range === "1D"
      ? fmtTime(scrub.time)
      : fmtDate(scrub.time)
    : range === "1D"
      ? "Live"
      : capitalize(RANGE_LABEL[range]);

  const emptyMessage =
    range === "1D"
      ? "Collecting live price data… check back in a few seconds."
      : candlesError
        ? `Couldn't load history: ${candlesError}`
        : `No historical data for the ${RANGE_LABEL[range]} yet.`;

  return (
    <>
      <div className="card">
        <div className="head">
          <div className="ttl">
            <h1>{symbol}</h1>
          </div>
          <div className="quote">
            <span className="price num">{displayPrice != null ? `$${money(displayPrice)}` : "—"}</span>
            <div className={`delta num${positive ? "" : " down"}`}>
              {displayDiff != null && displayPct != null ? `${signed(displayDiff)} · ${pctf(displayPct)}` : "—"}
            </div>
            <span className="scrub num">{scrubLabel}</span>
          </div>
        </div>

        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>

        <PriceChart
          history={series}
          positive={positive}
          onScrub={setScrub}
          formatLabel={range === "1D" ? fmtTime : fmtDate}
          emptyMessage={emptyMessage}
        />

        <dl className="stats">
          <div className="stat">
            <dt>Open</dt>
            <dd className="num">{statOpen != null ? `$${money(statOpen)}` : "—"}</dd>
          </div>
          <div className="stat">
            <dt>High</dt>
            <dd className="num">{statHigh != null ? `$${money(statHigh)}` : "—"}</dd>
          </div>
          <div className="stat">
            <dt>Low</dt>
            <dd className="num">{statLow != null ? `$${money(statLow)}` : "—"}</dd>
          </div>
          <div className="stat">
            <dt>{fourthLabel}</dt>
            <dd className="num">{fourthValue}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <NewsPanel symbol={symbol} />
      </div>
    </>
  );
}
