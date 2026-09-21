# RUDEMIR

Белорусская платформа управления компьютерными клубами и кибераренами: API, Windows-клиенты, веб-агрегатор и мобильные приложения.

Дизайн-система: `design-system/rudemir/MASTER.md` (бархат `#1A1230`, золото `#E0B84A`, сигнальный розовый `#FF3D7F`, шрифты Unbounded + Manrope). Скиллы для UI-работы лежат в `.cursor/skills/frontend-design` и `.cursor/skills/ui-ux-pro-max`.

## Что есть

- **Сайт** (`web-aggregator`): лендинг с живой картой зала, каталог клубов по городам, страница клуба (фото, цены, конфигурации ПК, услуги, карта зала, бронь с проверкой доступности, отзывы, турниры), кабинет гостя (брони, сессии, баланс bePaid/ЕРИП, друзья, достижения), консоль клуба (зал, брони, гости, касса, смена и отчёты), страницы `/business`, `/software`, `/app`, `/tournaments`, `/news`.
- **Windows-агент** (`windows-agent`): служба `RudemirAgent` на игровом ПК — heartbeat, очередь команд, hosts, политика заморозки (не драйвер), reboot, чистка путей. Привязка места одноразовым кодом.
- **Guest Client** (`windows-guest-client`): киоск на игровом ПК — вход по телефону или карте, таймер/баланс, лаунчер, пополнение, вызов администратора, заказ бара, чат. Блокировку и reboot выполняет агент.
- **Admin Console** (`windows-admin-console`): вкладки Зал (сессии, команды ПК, код агента, массовые действия, техрежим), Брони, Гости, Касса, Смена и отчёты.

Рынок: **Беларусь**. Валюта: **BYN (Br)**. Телефоны: **+375**. Часовой пояс: **Europe/Minsk**. Эквайринг (песочница): **bePaid / ЕРИП**.

## Стек

- Backend: NestJS + Prisma + PostgreSQL + Redis + Socket.IO
- Windows: .NET 8 WPF (Guest Client, Admin Console) + Windows Service (Rudemir.Agent)
- Web: Next.js (каталог и бронирование)
- Mobile: Expo / React Native (Guest, Business, Admin)

## Быстрый старт (API)

```bash
copy .env.example .env
docker compose up -d postgres redis
npm install
npx prisma generate --schema backend/prisma/schema.prisma
npx prisma db push --schema backend/prisma/schema.prisma
npx ts-node --transpile-only backend/prisma/seed.ts
npm run start:dev -w backend
```

PostgreSQL в Docker проброшен на **5434** (на Windows часто занят системный 5432).

Полный стек API+nginx: `docker compose --profile full up -d`

Веб-агрегатор: `npm run dev -w web-aggregator` → `http://localhost:3001`

Windows-клиенты (нужен запущенный API). **net8.0-windows**, self-contained `win-x64`:

```powershell
dotnet publish windows-agent\Rudemir.Agent.csproj -c Release -r win-x64 --self-contained true
dotnet publish windows-guest-client\Rudemir.GuestClient.csproj -c Release -r win-x64 --self-contained true
dotnet publish windows-admin-console\Rudemir.AdminConsole.csproj -c Release -r win-x64 --self-contained true
# или
powershell -ExecutionPolicy Bypass -File windows-agent\publish.ps1
```

Установка на игровой ПК (от администратора):

```powershell
powershell -ExecutionPolicy Bypass -File windows-agent\install.ps1 -Package AgentGuest -ApiBase http://API:3000
```

Стойка администратора:

```powershell
powershell -ExecutionPolicy Bypass -File windows-agent\install.ps1 -Package Admin -ApiBase http://API:3000
```

Привязка места: в консоли клуба (вкладка зал / устройства) нажмите **Код агента**, на ПК:

```
"C:\Program Files\Rudemir\Agent\Rudemir.Agent.exe" pair --api http://API:3000 --club <clubId> --seat <seatId> --code ABCDEFGH
```

Конфиг агента: `C:\ProgramData\Rudemir\agent.json`. Киоск читает `guest.json` из той же папки — руками `appsettings.json` в проде не заполняют.

Канал обновлений: `GET /api/v1/agent/update?channel=stable|beta` → `{ version, url, sha256, notes }`. URL задаётся env `AGENT_UPDATE_URL` / `AGENT_UPDATE_VERSION` / `AGENT_UPDATE_SHA256` (для beta — `AGENT_UPDATE_BETA_*`). Пока URL пустой, агент только проверяет контракт.

Порты: API **3000**, сайт **3001**. `prisma generate` / `db push` требует короткой остановки процесса на `:3000`.

Демо TECH_ADMIN: `+375291000005` / `tech123`.

Мобильные приложения (Expo):

```bash
cd mobile-admin-app && npx expo start
cd mobile-guest-app && npx expo start
cd mobile-business-app && npx expo start
```

## Демо-аккаунты

| Роль        | Телефон         | Пароль    |
|-------------|-----------------|-----------|
| Superadmin  | +375291000001   | admin123  |
| Owner       | +375291000002   | owner123  |
| Админ смены | +375291000003   | admin123  |
| Гость       | +375291000004   | guest123  |
| TECH_ADMIN  | +375291000005   | tech123   |

Карта гостя: `10000004` / PIN `1234`. OTP в dev: `0000`.

Клубы: `rudemir-minsk` (Минск), `rudemir-gomel` (Гомель).

## Основные сценарии API

1. `POST /api/v1/auth/login`
2. `POST /api/v1/payments/mock-topup` `{ "amountKopecks": 5000 }` — 50.00 Br через bePaid sandbox
3. `POST /api/v1/clubs/:clubId/sessions` — старт сессии (admin)
4. `GET /api/v1/meta` — рынок BY, города, валюта
5. `POST /api/v1/payments/checkout` — `{ "amountKopecks": 1500, "method": "bepaid" | "erip" }`
6. `POST /api/v1/payments/:id/sandbox-complete` и `POST /api/v1/payments/webhooks/bepaid`
7. Турниры: `POST /tournaments/:id/start`, результат матча
8. Аналитика: occupancy / revenue / retention / shift-report; смены `POST /shifts/open`
9. `GET /api/v1/metrics` — Prometheus
10. Друзья: `POST /me/friends`, принять/отклонить; карта гостя `POST /auth/card`, `GET /clubs/:id/guest-cards/:number`
11. Вызов админа `POST /clubs/:id/seats/:seatId/call`, чат, бонусы, достижения
12. Зал: `GET /clubs/:id/availability?from&to`, `GET /clubs/:id/guests?q`, `GET /clubs/:id/hardware`, `POST /bookings/:id/arrive`, `GET /clubs/:id/orders`, `POST /clubs/:id/orders/:orderId/status`
13. WebSocket: `auth.token` = access JWT, комнаты `join_club` / `join_seat`

## Тесты

```bash
DISABLE_TICKER=1 npm run test:e2e -w backend
```

## Структура

```
backend/                 NestJS API
windows-agent/            служба на игровом ПК
windows-guest-client/    WPF киоск
windows-admin-console/   WPF консоль стойки
web-aggregator/          Next.js каталог клубов
mobile-guest-app/        Expo — гости
mobile-business-app/     Expo — владельцы
mobile-admin-app/        Expo — смена
shared/                  типы и HTTP SDK
```
