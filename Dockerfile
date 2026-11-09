# ════════════════════════════════════════════════
#  ZYNTRIXLY 2.0 — Production Dockerfile
#  Ultra-lightweight static server via Caddy
# ════════════════════════════════════════════════

FROM caddy:2-alpine

# Set working directory
WORKDIR /srv

# Copy static assets and application files
COPY index.html ./
COPY app.js crypto.js webrtc.js security.js sw.js ./
COPY style.css shadcn.css manifest.webmanifest ./
COPY app-icon.svg app-icon.png zyntrixly-logo.svg zyntrixly-logo.png ./
COPY assets ./assets/
COPY src ./src/
COPY api ./api/
COPY Caddyfile /etc/caddy/Caddyfile

# Expose HTTP port
EXPOSE 80

# Run Caddy server
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
