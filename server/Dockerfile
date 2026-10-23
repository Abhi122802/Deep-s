# Multi-stage Dockerfile for Deep's Cake Shop Backend Server
# Stage 1: Build TypeScript source code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy lockfile and package descriptor for reproducible dependency installation
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for tsc build)
RUN npm ci

# Copy TypeScript configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript into JavaScript (output: /app/dist)
RUN npm run build

# Stage 2: Minimal production runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=5000

# Copy lockfile and package descriptor for production dependency installation
COPY package.json package-lock.json ./

# Install production dependencies only and clear cache
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Create local uploads directory fallback and set non-root ownership
RUN mkdir -p /app/uploads && chown -R node:node /app

# Switch to non-root user for security hardening
USER node

# Expose backend application port
EXPOSE 5000

# Container healthcheck using Node.js built-in fetch against /api/health with dynamic PORT support
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the compiled production server
CMD ["node", "dist/index.js"]
