FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY shared/types/package.json shared/types/package.json
COPY shared/sdk/package.json shared/sdk/package.json
COPY backend/package.json backend/package.json
RUN npm install --workspace=backend --workspace=@arenaos/types --workspace=@arenaos/sdk --legacy-peer-deps

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/shared/types
RUN npx tsc -p tsconfig.json
WORKDIR /app/backend
RUN npx prisma generate
RUN npx nest build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
