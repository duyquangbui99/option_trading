import { useState } from "react";

export default function AddStockForm({ onAdd }) {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!symbol.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(symbol);
      setSymbol("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className={`search${symbol.trim() ? " filled" : ""}`} onSubmit={handleSubmit}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="7" cy="7" r="4.6" />
          <path d="M10.4 10.4L14 14" strokeLinecap="round" />
        </svg>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add a symbol"
          aria-label="Add a symbol"
          autoComplete="off"
          spellCheck="false"
          disabled={busy}
        />
        <button className="go" type="submit" disabled={busy || !symbol.trim()} aria-label="Add symbol">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 4.75a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" />
          </svg>
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
