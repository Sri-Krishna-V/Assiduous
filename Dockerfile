FROM node:18-alpine

WORKDIR /app

# Install SSL certificates (critical fix)
RUN apk add --no-cache ca-certificates

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]