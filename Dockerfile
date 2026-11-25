FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

# Copy source
COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

# Generate Prisma client & build backend + frontend
ENV DATABASE_URL="file:/app/storage/mediaflow.db"
RUN npm run build --prefix backend && npm run build --prefix frontend

RUN mkdir -p /app/storage/uploads /app/storage/downloads /app/storage/temp

ENV NODE_ENV=production
ENV PORT=4000
ENV STORAGE_ROOT=/app/storage
ENV CLIENT_ORIGIN=*

EXPOSE 4000

CMD ["npm", "run", "start", "--prefix", "backend"]
