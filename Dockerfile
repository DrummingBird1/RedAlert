FROM node:20-alpine
LABEL org.opencontainers.image.title="Israel Alert Map"
LABEL org.opencontainers.image.description="Real-time Pikud HaOref alert monitoring"
LABEL org.opencontainers.image.source="https://github.com/DrummingBird1/RedAlert"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy app sources (everything needed at runtime)
COPY server.js index.html openapi.yaml package.json ./

# Pre-create runtime dirs (logs rotates here; VAPID keys + push-subs live in /app root)
RUN mkdir -p /app/logs

# Optional: install web-push for background push notifications.
# Uncomment to bake into the image; otherwise set via fly secrets if needed.
# RUN npm install --omit=dev --no-audit --no-fund web-push

EXPOSE 3000

# Docker healthcheck — only used in local docker/docker-compose runs.
# Fly.io uses its own checks (defined in fly.toml under [[http_service.checks]]).
# Uses node (always present) instead of wget (might be missing in slimmer images).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENV PORT=3000 \
    ADMIN_USER=admin \
    ADMIN_PASS=changeme \
    NODE_ENV=production

CMD ["node", "server.js"]
