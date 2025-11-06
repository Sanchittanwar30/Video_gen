FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript (if needed)
# RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Default command (can be overridden)
CMD ["npm", "run", "start:api"]

