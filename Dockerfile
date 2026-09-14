# Stage 1: Builder
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files only (leverage Docker layer cache)
COPY package*.json ./

# Install dependencies (production + dev for build steps)
RUN npm ci --verbose

# Copy source code
COPY . .

# Build if needed (adjust this step based on your build process)
RUN npm run build --if-present


# Stage 2: Runtime
FROM node:24-alpine

WORKDIR /app

# Install dumb-init to handle signals properly in containers
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built app and dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["npm", "run", "api:dev"]
