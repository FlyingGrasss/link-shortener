# syntax=docker/dockerfile:1

# Native better-sqlite3 may need a compiler if no prebuilt binary matches Node 26.
FROM node:26-slim AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN (corepack enable pnpm 2>/dev/null || true) \
    && (corepack prepare pnpm@12.16.1 --activate \
        || npm install --global pnpm@12.16.1)

# pnpm-workspace.yaml carries the allowBuilds list for better-sqlite3.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node src ./src

RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 4200

CMD ["node", "src/index.ts"]
