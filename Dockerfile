# Build stage
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app

# Server deps
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Server source
COPY server/index.js server/config.js server/auth.js server/jellyfin.js \
     server/serverManager.js server/plexClient.js server/tmdb.js ./server/
COPY server/routes/ ./server/routes/

# Built frontend
COPY --from=builder /build/server/public ./server/public

RUN mkdir -p /app/data
EXPOSE 3000
ENV CONFIG_PATH=/app/data/config.json
CMD ["node", "server/index.js"]
