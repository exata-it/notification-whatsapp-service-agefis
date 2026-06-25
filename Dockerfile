FROM oven/bun:debian AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN bun install --frozen-lockfile

RUN bun x prisma generate

COPY src ./src
COPY jsconfig.json ./

# Imagem final com Bun runtime
FROM oven/bun:alpine

RUN apk add --no-cache \
    ca-certificates \
    openssl \
    curl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/jsconfig.json ./
COPY --from=builder /app/prisma.config.ts ./

ENV NODE_ENV=production \
    TZ=America/Fortaleza

EXPOSE 3000
CMD ["bun", "run", "src/index.js"]