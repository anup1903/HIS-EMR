FROM node:20-alpine

# better-sqlite3 needs build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
