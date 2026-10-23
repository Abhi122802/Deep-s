# Multi-stage Dockerfile for Deep's Cake Shop Frontend
# Stage 1: Build React/Vite production bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Build-time argument for API base URL (defaults to /api for reverse-proxy deployment)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy lockfile and package descriptor for reproducible dependency installation
COPY package.json package-lock.json ./

# Install frontend dependencies
RUN npm ci

# Copy configuration and source files
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public/ ./public/
COPY src/ ./src/

# Build static production assets (output: /app/dist)
RUN npm run build

# Stage 2: Serve static production assets via Nginx
FROM nginx:1.27-alpine AS runner

# Copy custom Nginx configuration with SPA fallback and API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web server HTTP port
EXPOSE 80

# Web server healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
