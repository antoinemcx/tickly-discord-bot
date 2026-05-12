# ---- Build stage ----
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY config.ts config.example.ts ./
COPY src/ ./src/

RUN npm run build


# ---- Production stage ----
FROM node:22-bookworm-slim

RUN groupadd --system tickly && useradd --system --gid tickly --shell /bin/false tickly

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/build/ ./build/

# Copy SQL migration files (not compiled by tsc)
COPY src/database/migrations/ ./build/src/database/migrations/

RUN chown -R tickly:tickly /app

USER tickly

ENV NODE_ENV=production
EXPOSE 3999

CMD ["node", "."]
