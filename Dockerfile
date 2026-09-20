# ================================================================
# STAGE 1: Build stage (Compile Babel ES6+ to standard Node.js)
# ================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer cache
COPY package*.json ./

# Install dependencies (including devDependencies needed for Babel compiler)
RUN npm install --no-audit

# Copy application source code
COPY . .

# Compile Babel code into /app/build
RUN npm run build

# ================================================================
# STAGE 2: Production runtime stage (Lean, secure, non-root)
# ================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install dumb-init for graceful shutdown & proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init

# Copy dependency manifests
COPY package*.json ./

# Install ONLY production dependencies to minimize image size and attack surface
RUN npm install --omit=dev --no-audit && npm cache clean --force

# Copy compiled production artifacts from builder stage
COPY --from=builder /app/build ./build

# Create uploads directory and set permissions to non-root 'node' user
RUN mkdir -p uploads && chown -R node:node /app

# Senior Security Standard: Drop root privileges, run as 'node' user
USER node

# Expose backend application port
EXPOSE 3000

# Docker / K8s Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.APP_PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application using dumb-init wrapper
CMD ["dumb-init", "node", "./build/src/server.js"]
