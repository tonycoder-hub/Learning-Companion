export const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

export function isIsoDateTimeWithTimezone(value) {
  const text = String(value || "").trim();
  const match = text.match(ISO_DATE_TIME_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] ? Number(match[10]) : 0;
  const offsetMinute = match[9] ? Number(match[11]) : 0;
  return Number.isFinite(Date.parse(text))
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(year, month)
    && hour >= 0
    && hour <= 23
    && minute >= 0
    && minute <= 59
    && second >= 0
    && second <= 59
    && offsetHour >= 0
    && offsetHour <= 23
    && offsetMinute >= 0
    && offsetMinute <= 59;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
