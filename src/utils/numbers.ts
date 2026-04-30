export function formatNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrency(value: number, currency: string) {
  const normalizedCurrency = normalizeCurrency(currency);
  const maximumFractionDigits = value < 1 ? 4 : 2;

  if (isIsoCurrencyCode(normalizedCurrency) && normalizedCurrency !== "USD") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits,
      }).format(value);
    } catch {
      return formatSymbolCurrency(value, normalizedCurrency, maximumFractionDigits);
    }
  }

  return formatSymbolCurrency(
    value,
    normalizedCurrency === "USD" ? "$" : normalizedCurrency,
    maximumFractionDigits,
  );
}

export function normalizeCurrency(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.toUpperCase() === "USD") {
    return "$";
  }

  return trimmed;
}

export function parseNumberInput(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSymbolCurrency(value: number, currency: string, maximumFractionDigits: number) {
  const formattedValue = formatNumber(value, maximumFractionDigits);
  const symbol = currency || "$";
  const separator = /[A-Za-z]$/.test(symbol) ? " " : "";

  return `${symbol}${separator}${formattedValue}`;
}

function isIsoCurrencyCode(currency: string) {
  return /^[A-Z]{3}$/.test(currency);
}
