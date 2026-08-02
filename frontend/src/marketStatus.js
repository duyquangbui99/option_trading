const CLOSED_DAYS = new Set(["Sat", "Sun"]);

// NYSE regular session: 9:30am-4:00pm ET, weekdays. Doesn't account for holidays.
export function isMarketOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  if (CLOSED_DAYS.has(map.weekday)) return false;

  const minutes = Number(map.hour) * 60 + Number(map.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
