import { useEffect, useState } from "react";
import { getOverview } from "../api";

function renderBlocks(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks = [];
  let currentList = null;
  for (const line of lines) {
    const isBullet = /^[-•]\s+/.test(line);
    if (isBullet) {
      if (!currentList) {
        currentList = [];
        blocks.push({ type: "list", items: currentList });
      }
      currentList.push(line.replace(/^[-•]\s+/, ""));
    } else {
      currentList = null;
      blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

export default function Overview({ symbol }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load(force) {
    setLoading(true);
    setError(null);
    try {
      const data = await getOverview(symbol, { force });
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOverview(null);
    setError(null);
    load(false);
    // symbol change should trigger a fresh fetch; load() intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const blocks = overview ? renderBlocks(overview.text) : [];

  return (
    <>
      <div className="section-head">
        <h2>Overview</h2>
        <button className="ghost" onClick={() => load(true)} disabled={loading}>
          {loading ? "Generating…" : "Refresh"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && !overview && (
        <p className="empty-state">Generating AI overview… this can take up to a minute.</p>
      )}
      {overview && (
        <div className="overview-body">
          {blocks.map((b, i) =>
            b.type === "list" ? (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b.text}</p>
            ),
          )}
        </div>
      )}
      {overview && (
        <p className="rail-note">
          AI-generated summary for informational purposes only — not investment advice. Verify independently
          before trading.
        </p>
      )}
    </>
  );
}
