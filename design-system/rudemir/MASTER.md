# RUDEMIR design system

Subject: сеть компьютерных клубов Беларуси. Audience: 16–30, гости бронируют ПК; смена ведёт зал. Job: увидеть свободные места за 0.3 с, взять слот, оплатить в Br.

Язык: табло зала / HUD киберарены. Не билет, не бархат.

## Tokens

| Name | Hex | Role |
|------|-----|------|
| `--bg-base` | `#050505` | page |
| `--bg-elevated` | `#111111` | panels |
| `--accent-primary` | `#2015FF` | CTA, focus, свободное место |
| `--accent-secondary` | `#ff8562` | цена, ссылка, занято |
| `--text-primary` | `#FFFFFF` | headlines, body on dark |
| `--text-secondary` | `#A0A0A0` | secondary copy |
| `--border-color` | `#222222` | rules, 32px grid |

Type: **Unbounded** 500/600/700 display, **Roboto** 300/400/500 body. Cyrillic required.

Scale (Major Third): 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64. Spacing multiples of 8. Radius ≤ 8px (buttons/fields 2–4px).

## Layout

Asymmetry 2/3 + 1/3. Headline Unbounded 48–80px, leading ~1.0, left. HUD hall overlaps headline 24–48px. Club cards: horizontal slice, 2/3 media / 1/3 data, no radius at the join.

## Principles

1. Money always as `12.00 Br`, coral.
2. Free = blue, occupied / price / link = coral.
3. No ALL CAPS eyebrows, no pills, no purple-pink gradients, no Unsplash gamer portraits.
4. CTA hover: fill `#2015FF` + `box-shadow: 0 0 24px rgba(32,21,255,.45)`. Ease `cubic-bezier(0.16, 1, 0.3, 1)`, 200–320ms. Honor `prefers-reduced-motion`.
5. Focus: outline 2px `#2015FF`.

## Responsive

- Desktop ≥1280: 2/3 + 1/3, HUD overlap −32px, club cards full-width alternating L/R.
- Tablet 768–1279: HUD under H1 full width, club cards 2-up, media on top.
- Mobile <768: H1 32–36px leading 1.05 in flow. Hall = horizontal snap cards. Clubs 1-up. Bottom bar 56px, 4 segments, 2px blue underline.

## States

- Loading: 32px `--border-color` skeleton, opacity 0.4↔1 / 1.2s. No spinners.
- Empty: Unbounded 500 / 24px / `--text-secondary`. «В этом городе пока тихо»
- Error: coral plate, white text, «Повторить» outline 2px coral.
- Success: 200ms blue flash on booking panel + 2px rectangle mark. «Бронь активна. 18:00–20:00»

## Signature

Hover free seat → blue glow. Click → pulse twice 320ms, then booking. Free counter ticks 120ms vertical. Route change: 2px blue line across the top, 200ms. Nothing else decorative.

## Nav

Desktop: header 56px. «Войти» radius 2px, hover fill + glow. Mobile: wordmark only on top; bottom bar Clubs / Tournaments / App / Cabinet. Icons 20×20, 2px stroke rectangles.

## Voice

Buttons 2–3 words: Войти, Бронь, Оплата, Отмена, В зал, Клубы, Повторить. No please/sorry. Errors: «Связь потеряна. Повторить». Statuses without a trailing period. Headlines Unbounded, no exclamation.

