FROM oven/bun:1.2.23 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.2.23 AS runner
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

EXPOSE 4888
CMD ["bun", "dist/index.js"]
