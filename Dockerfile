# Stage 1: Builder
FROM node:24-alpine AS builder

WORKDIR /app

# Install native build tools for compiling C/C++ addons (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files first to maximize layer cache hit
COPY package*.json ./

# Configure npm legacy peer deps for resolving peer conflicts
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

# Install all dependencies (keeping optional for platform-native bundlers like Vite/Rolldown)
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Copy source code
COPY . .

# Build UI if present (Vite compiles React frontend into src/ui/dist)
RUN npm run ui:build --if-present

# Prune dev dependencies so node_modules contains only production modules
RUN npm prune --omit=dev


# Stage 2: Runtime
FROM node:24-alpine

# Multi-line RUN consolidates layers for smaller image
RUN apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production node_modules and package.json from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy built artifacts and source from builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/modules ./modules

# Set production environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Health check: query endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -sf http://localhost:3000/health || exit 1

# Use dumb-init to handle PID 1 signals
ENTRYPOINT ["dumb-init", "--"]

# Start API in production mode
CMD ["node", "src/api/server.js"]
