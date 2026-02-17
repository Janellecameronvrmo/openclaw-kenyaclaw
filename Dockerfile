# KenyaClaw - Customer OpenClaw Instance
# Multi-tenant AI assistant for African businesses

FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache \
    git \
    curl \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Clone OpenClaw upstream
ARG OPENCLAW_VERSION=main
RUN git clone --depth 1 --branch ${OPENCLAW_VERSION} https://github.com/openclaw/openclaw.git . 2>/dev/null || \
    (echo "Using local source" && mkdir -p /app)

# Copy OpenClaw source (fallback)
COPY ./src/ /app/ 2>/dev/null || true

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build OpenClaw
RUN pnpm build

# Copy KenyaClaw customizations
COPY ./agents/ /app/agents/
COPY ./skills/ /app/skills/
COPY ./config.yml /app/config.yml

# Create memory directories for multi-tenancy
RUN mkdir -p /memory/customers /sessions

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Expose gateway port
EXPOSE 3003

# Run OpenClaw with our config
CMD ["pnpm", "start", "--config", "/app/config.yml"]
