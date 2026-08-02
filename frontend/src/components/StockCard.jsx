function Sparkline({ history, positive }) {
  const w = 58,
    h = 20;
  if (!history || history.length < 2) {
    return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />;
  }

  const prices = history.map((p) => p.price);
  const lo = Math.min(...prices),
    hi = Math.max(...prices);
  const range = hi - lo || 1;
  const d = prices
    .map((v, i) => `${(i / (prices.length - 1)) * w},${h - 1 - ((v - lo) / range) * (h - 2)}`)
    .join(" L");
  const stroke = positive ? "var(--green)" : "var(--red)";

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M${d}`} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function StockCard({ stock, history, selected, onSelect, onRemove }) {
  const { symbol, price, percentChange, trend } = stock;
  const positive = trend !== "down";

  return (
    <button className="row" role="option" aria-selected={selected} onClick={() => onSelect(symbol)}>
      <span className="sym">{symbol}</span>
      <Sparkline history={history} positive={positive} />
      <span className="rt">
        <span className="p num">{price != null ? `$${price.toFixed(2)}` : "…"}</span>
        <span className={`pill num${trend === "down" ? " down" : ""}`}>
          {percentChange != null ? `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%` : "—"}
        </span>
      </span>
      <span
        className="kill"
        role="button"
        tabIndex={0}
        aria-label={`Remove ${symbol}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(symbol);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onRemove(symbol);
          }
        }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </span>
    </button>
  );
}
