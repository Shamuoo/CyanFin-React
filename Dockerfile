# Build stage - compile React frontend
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Built output is now in /build/server/public/

# Runtime stage
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy server source (excluding public/ - we use the built version)
COPY server/index.js server/jellyfin.js server/auth.js server/config.js server/tmdb.js server/serverManager.js ./server/
COPY server/routes/ ./server/routes/

# Copy freshly built frontend (overrides anything in server/public)
COPY --from=builder /build/server/public ./server/public

RUN mkdir -p /app/data
EXPOSE 3000
ENV CONFIG_PATH=/app/data/config.json
CMD ["node", "server/index.js"]
