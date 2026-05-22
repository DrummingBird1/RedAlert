FROM node:20-alpine
LABEL maintainer="alertmap" description="Israel Alert Map — Real-time Pikud HaOref monitoring"

WORKDIR /app

# Copy app files
COPY server.js index.html ./

# Create logs directory
RUN mkdir -p /app/logs

# Optional: install web-push for background push notifications
# RUN npm init -y && npm install web-push

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENV PORT=3000 \
    ADMIN_USER=admin \
    ADMIN_PASS=changeme \
    NODE_ENV=production

CMD ["node", "server.js"]
