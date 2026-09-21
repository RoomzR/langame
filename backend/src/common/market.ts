export const MARKET = {
  country: 'BY',
  countryName: 'Беларусь',
  currency: 'BYN',
  currencyLabel: 'Br',
  timezone: 'Europe/Minsk',
  locale: 'ru-BY',
  locales: ['ru', 'be', 'en'],
  cities: ['Минск', 'Гомель', 'Брест', 'Гродно', 'Витебск', 'Могилёв'],
  payments: ['bepaid', 'erip', 'webpay'],
} as const;

export function formatByn(kopecks: number) {
  return `${(kopecks / 100).toFixed(2)} Br`;
}
