import { useEffect, useState } from "react";
import { getNews } from "../api";

export default function NewsPanel({ symbol }) {
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews(symbol);
      setNews(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setNews(null);
    setError(null);
    load();
    // symbol change should trigger a fresh fetch; load() intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <>
      <div className="section-head">
        <h2>News</h2>
        <button className="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {news && news.length === 0 && <p className="empty-state">No recent news found.</p>}
      {news && news.length > 0 && (
        <div>
          {news.map((item) => (
            <a key={item.url} className="item" href={item.url} target="_blank" rel="noreferrer">
              <div className="meta">
                {item.source} · {new Date(item.datetime * 1000).toLocaleDateString()}
              </div>
              <div className="hl">{item.headline}</div>
              {item.summary && <p className="sub">{item.summary}</p>}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
