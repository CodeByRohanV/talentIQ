# Stage 1: Build React Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for Vite
ARG VITE_API_URL=/api/
ARG VITE_TENANT_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TENANT_URL=$VITE_TENANT_URL

# Copy package management files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build files from stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
