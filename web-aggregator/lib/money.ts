export const MARKET = {
  country: "BY",
  currency: "BYN",
  currencyLabel: "Br",
  cities: ["Минск", "Гомель", "Брест", "Гродно", "Витебск", "Могилёв"],
} as const;

export function formatByn(kopecks?: number | null) {
  return `${((Number(kopecks) || 0) / 100).toFixed(2)} Br`;
}
