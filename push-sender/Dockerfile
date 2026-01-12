# Multi-stage build for minimal image size

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY index.ts tsconfig.json ./

# Install tsx for runtime TypeScript execution
RUN npm install -g tsx

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install tsx globally in production image
RUN npm install -g tsx

# Copy dependencies and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/index.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=60s --timeout=3s --start-period=5s \
  CMD node -e "process.exit(0)"

# Start the service
CMD ["tsx", "index.ts"]
