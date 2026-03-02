FROM node:18-alpine

WORKDIR /app

# Install SSL certificates (critical fix)
RUN apk add --no-cache ca-certificates

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

USER node

EXPOSE 3000

CMD ["node", "server.js"]