# -----------------------------------------------------------------------------
# Stage 1: Dependencies & Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install openssl for Prisma on Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install full dependencies and generate Prisma Client
RUN npm ci
RUN npx prisma generate

# Prune development dependencies
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: Production Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl openssl

ENV NODE_ENV=production
ENV PORT=4000

# Run as non-root node user
USER node

# Copy production dependencies and generated Prisma client
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node package*.json ./
COPY --chown=node:node app.js server.js ./
COPY --chown=node:node src ./src

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "server.js"]
