const DICTIONARY_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";
const TRANSLATE_BASE = "https://translate.googleapis.com/translate_a/single";

export const MAX_TEXT_LEN = 80;

// Definitions/translations don't go stale, so this cache has no TTL — it
// lives for the process lifetime, same as watchlist.js's in-memory history.
const cache = new Map(); // normalizedText -> { at, data }

const normalize = (t) => t.trim().toLowerCase().replace(/\s+/g, " ");

async function fetchDefinition(text) {
  try {
    const res = await fetch(`${DICTIONARY_BASE}/${encodeURIComponent(text)}`);
    if (!res.ok) return null; // 404 = not a dictionary word, not an error
    const body = await res.json();
    const meaning = body[0]?.meanings?.[0];
    const def = meaning?.definitions?.[0]?.definition;
    if (!def) return null;
    return meaning.partOfSpeech ? `(${meaning.partOfSpeech}) ${def}` : def;
  } catch {
    return null;
  }
}

async function fetchTranslation(text) {
  try {
    const url = new URL(TRANSLATE_BASE);
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "vi");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    return body[0].map((chunk) => chunk[0]).join("");
  } catch {
    return null;
  }
}

export async function getDefinition({ text }) {
  const trimmed = (text ?? "").toString().trim();
  if (!trimmed) throw new Error("No text was selected");
  if (trimmed.length > MAX_TEXT_LEN) {
    throw new Error(`Select a shorter phrase (under ${MAX_TEXT_LEN} characters)`);
  }

  const key = normalize(trimmed);
  const cached = cache.get(key);
  if (cached) return cached.data;

  const [definition, vietnamese] = await Promise.all([fetchDefinition(trimmed), fetchTranslation(trimmed)]);
  if (!definition && !vietnamese) {
    throw new Error(`Couldn't find a definition or translation for "${trimmed}".`);
  }

  const data = { definition, vietnamese, generatedAt: new Date().toISOString() };
  cache.set(key, { at: Date.now(), data });
  return data;
}
