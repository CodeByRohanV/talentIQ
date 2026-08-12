# Production Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose backend API port
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production

# Command to start Express server
CMD ["npm", "start"]
