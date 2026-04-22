FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

# Copy source
COPY backend/ backend/
COPY frontend/ frontend/

# Build
RUN pnpm -r build

# Production image
FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=base /app/backend/package.json backend/
COPY --from=base /app/backend/dist/ backend/dist/
COPY --from=base /app/backend/src/db/migrations/ backend/dist/db/migrations/
COPY --from=base /app/backend/node_modules/ backend/node_modules/
COPY --from=base /app/frontend/dist/ frontend/dist/
COPY --from=base /app/node_modules/ node_modules/

ENV NODE_ENV=production
EXPOSE 3001 3002

CMD ["node", "backend/dist/index.js"]
