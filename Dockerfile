FROM node:20-alpine

WORKDIR /app

# Install Sharp dependencies
RUN apk add --no-cache vips-dev

# For HEIC support (optional, increases image size):
# RUN apk add --no-cache vips-dev libheif-dev

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Create directories for runtime files
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run process wrapper
CMD ["node", "start.js"]
