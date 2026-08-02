import { useEffect, useState } from "react";
import AddStockForm from "./components/AddStockForm";
import StockList from "./components/StockList";
import StockDetail from "./components/StockDetail";
import WordLookup from "./components/WordLookup";
import { getWatchlist, addToWatchlist, removeFromWatchlist, getHistory } from "./api";
import { isMarketOpen } from "./marketStatus";
import "./App.css";

const POLL_MS = 15_000;

export default function App() {
  const [watchlist, setWatchlist] = useState([]);
  const [histories, setHistories] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getWatchlist();
        if (cancelled) return;
        setWatchlist(data);
        setLoadError(null);
        setLastUpdated(new Date());
        setMarketOpen(isMarketOpen());

        const entries = await Promise.all(
          data.map(async (s) => {
            try {
              return [s.symbol, await getHistory(s.symbol)];
            } catch {
              return [s.symbol, []];
            }
          }),
        );
        if (!cancelled) setHistories(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleAdd(symbol) {
    const updated = await addToWatchlist(symbol);
    setWatchlist(updated);
    setSelectedSymbol(symbol.trim().toUpperCase());
  }

  async function handleRemove(symbol) {
    const updated = await removeFromWatchlist(symbol);
    setWatchlist(updated);
    if (selectedSymbol === symbol) setSelectedSymbol(null);
  }

  const selectedStock = watchlist.find((s) => s.symbol === selectedSymbol) ?? null;

  return (
    <div className="app">
      <WordLookup />
      <header className="topbar">
        <div className="topbar-in">
          <span className="wordmark">Stocks</span>
          <span className="market">
            <span className={`dot${marketOpen ? "" : " closed"}`} />
            {marketOpen ? "Market open" : "Market closed"}
          </span>
          <span className="stamp num">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
      </header>

      <main className="wrap">
        <aside className="rail">
          <AddStockForm onAdd={handleAdd} />
          {loadError && <p className="form-error">{loadError}</p>}
          <StockList
            stocks={watchlist}
            histories={histories}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
            onRemove={handleRemove}
          />
          <p className="rail-note">Live quotes via Finnhub. Prices may be delayed depending on your plan.</p>
        </aside>

        <section>
          {selectedStock ? (
            <StockDetail stock={selectedStock} history={histories[selectedStock.symbol]} />
          ) : (
            <div className="card">
              <p className="empty-state">Select a stock to see its price chart and news.</p>
            </div>
          )}
        </section>
      </main>
      <p className="foot">Live data via Finnhub · Not investment advice</p>
    </div>
  );
}
