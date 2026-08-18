# Production Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Install Puppeteer dependencies for Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip downloading Chrome and use the installed Alpine version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy application source
COPY . .

# Expose backend API port
EXPOSE 5000

# Set production environment (optimizes Express) but label as test environment for S3
ENV NODE_ENV=production
ENV APP_ENV=test

# Command to start Express server
CMD ["npm", "start"]
