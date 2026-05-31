# Tarot frontend (Vite + React)
# 2-stage build: node để build, nginx để serve.

FROM node:20-alpine AS builder

WORKDIR /app

# Cài deps trước, leverage docker cache.
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Build-time env: nhận từ docker-compose hoặc CI.
# Default trỏ thẳng tới backend đã deploy để build quên truyền ARG không âm thầm bake localhost.
ARG VITE_API_BASE_URL=https://tranganh06uit-tarot-backend.hf.space
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

RUN npm run build

# Stage 2: nginx serve static.
FROM nginx:alpine

# Custom nginx config cho SPA: fallback về index.html.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    # Cache static assets lâu
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
