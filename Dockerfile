FROM node:22-slim

# Install FFmpeg for audio extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies and build
RUN npm ci
RUN npm run build

# Production environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "dist/index.js"]
