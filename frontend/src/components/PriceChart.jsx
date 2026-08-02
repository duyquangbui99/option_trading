import { useMemo, useRef, useState } from "react";

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const money = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const W = 640;
const H = 288;
const PAD = { t: 12, r: 58, b: 24, l: 6 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

export default function PriceChart({ history, positive, onScrub, formatLabel = fmtTime, emptyMessage }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const geo = useMemo(() => {
    if (!history || history.length < 2) return null;
    const prices = history.map((p) => p.price);
    const start = prices[0];
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    const padY = (hi - lo) * 0.14 || 1;
    lo -= padY;
    hi += padY;
    const X = (i) => PAD.l + (i / (history.length - 1)) * IW;
    const Y = (v) => PAD.t + IH - ((v - lo) / (hi - lo)) * IH;
    return { X, Y, lo, hi, start };
  }, [history]);

  if (!geo) {
    return (
      <p className="chart-placeholder">
        {emptyMessage ?? "Collecting live price data… check back in a few seconds."}
      </p>
    );
  }

  const { X, Y, lo, hi, start } = geo;
  const stroke = positive ? "var(--green)" : "var(--red)";
  const line = history.map((p, i) => `${X(i).toFixed(2)},${Y(p.price).toFixed(2)}`).join(" L");
  const area = `M${line} L${X(history.length - 1).toFixed(2)},${(PAD.t + IH).toFixed(2)} L${X(0).toFixed(2)},${(PAD.t + IH).toFixed(2)} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = lo + (hi - lo) * (i / ticks);
    return { y: Y(v), v };
  });

  const xi = [0, Math.floor(history.length * 0.33), Math.floor(history.length * 0.66), history.length - 1];

  function indexFromEvent(e) {
    const svg = svgRef.current;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let i = Math.round(((x - X(0)) / (X(history.length - 1) - X(0))) * (history.length - 1));
    return Math.max(0, Math.min(history.length - 1, i));
  }

  function handleMove(e) {
    const i = indexFromEvent(e);
    setHoverIndex(i);
    onScrub?.(history[i]);
  }

  function handleLeave() {
    setHoverIndex(null);
    onScrub?.(null);
  }

  return (
    <div className="chart" onPointerMove={handleMove} onPointerDown={handleMove} onPointerLeave={handleLeave} onPointerCancel={handleLeave}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price chart">
        <defs>
          <linearGradient id="chart-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map(({ y, v }, i) => (
          <g key={i}>
            <line className="grid-line" x1={PAD.l} y1={y} x2={PAD.l + IW} y2={y} />
            <text className="axis" x={PAD.l + IW + 8} y={y + 3.5}>
              ${money(v)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#chart-fade)" />
        <line className="base" x1={PAD.l} y1={Y(start)} x2={PAD.l + IW} y2={Y(start)} />
        <path d={`M${line}`} fill="none" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
        {hoverIndex != null && (
          <g>
            <line className="cross" x1={X(hoverIndex)} x2={X(hoverIndex)} y1={PAD.t} y2={PAD.t + IH} />
            <circle className="knob" cx={X(hoverIndex)} cy={Y(history[hoverIndex].price)} r="4.5" fill={stroke} />
          </g>
        )}
        {xi.map((i, k) => (
          <text
            key={k}
            className="axis"
            x={X(i)}
            y={H - 6}
            textAnchor={k === 0 ? "start" : k === xi.length - 1 ? "end" : "middle"}
          >
            {formatLabel(history[i].time)}
          </text>
        ))}
      </svg>
    </div>
  );
}
