const dayMs = 24 * 60 * 60 * 1000;

export function todayIso() {
  return new Date().toISOString();
}

export function toDateInputValue(iso?: string) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function dateInputValueToIso(value: string) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export function formatDate(iso?: string) {
  if (!iso) {
    return "Not set";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isOlderThanDays(iso: string, days: number, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return now.getTime() - date.getTime() > days * dayMs;
}

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * dayMs).toISOString();
}
