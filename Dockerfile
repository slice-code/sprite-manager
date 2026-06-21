# --- Build stage ---
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage ---
FROM node:22-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV BIND_HOST=127.0.0.1
ENV SERVE_STATIC=false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && mkdir -p /app/data/uploads

# Nginx serves the frontend and proxies to the API on port 3001
EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
