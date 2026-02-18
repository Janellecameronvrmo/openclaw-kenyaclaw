# ═══════════════════════════════════════════════════════════════════════════
# KENYACLAW - Customer Instance Dockerfile
# Continental for Everyone - 3 Customer Personas
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache curl ca-certificates

# Create app directory
WORKDIR /app

# ═══════════════════════════════════════════════════════════════════════════
# Dependencies Stage
# ═══════════════════════════════════════════════════════════════════════════
FROM base AS dependencies

COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# ═══════════════════════════════════════════════════════════════════════════
# Build Stage
# ═══════════════════════════════════════════════════════════════════════════
FROM base AS build

COPY package*.json ./
RUN npm ci

COPY . .

# ═══════════════════════════════════════════════════════════════════════════
# Production Stage
# ═══════════════════════════════════════════════════════════════════════════
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/src ./src
COPY --from=build /app/agents ./agents
COPY --from=build /app/ui ./ui
COPY --from=build /app/config.yml ./
COPY --from=build /app/package*.json ./

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start command
CMD ["node", "src/index.js"]
