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

# Server source — copy everything so new files are never missed
COPY server/ ./server/

# Built frontend
COPY --from=builder /build/server/public ./server/public

RUN mkdir -p /app/data
EXPOSE 3000
ENV CONFIG_PATH=/app/data/config.json
CMD ["node", "server/index.js"]
