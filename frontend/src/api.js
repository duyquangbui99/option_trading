const TOKEN_KEY = "authToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, options) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    clearToken();
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Request to ${path} failed (${res.status})`);
  }
  return data;
}

export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Login failed");
  }
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

export const getWatchlist = () => request("/watchlist");

export const addToWatchlist = (symbol) =>
  request("/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });

export const removeFromWatchlist = (symbol) =>
  request(`/watchlist/${symbol}`, { method: "DELETE" });

export const getHistory = (symbol) => request(`/stocks/${symbol}/history`);

export const getCandles = (symbol, range) => request(`/stocks/${symbol}/candles?range=${range}`);

export const getOverview = (symbol, { force } = {}) =>
  request(`/stocks/${symbol}/overview${force ? "?force=true" : ""}`);

export const getNews = (symbol) => request(`/stocks/${symbol}/news`);

export const getDefinition = (text) => request("/define", { method: "POST", body: JSON.stringify({ text }) });
