async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `Request to ${path} failed (${res.status})`);
  }
  return data;
}

export const getWatchlist = () => request("/watchlist");

export const addToWatchlist = (symbol) =>
  request("/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });

export const removeFromWatchlist = (symbol) =>
  request(`/watchlist/${symbol}`, { method: "DELETE" });

export const getHistory = (symbol) => request(`/stocks/${symbol}/history`);

export const getCandles = (symbol, range) => request(`/stocks/${symbol}/candles?range=${range}`);

export const getNews = (symbol) => request(`/stocks/${symbol}/news`);
