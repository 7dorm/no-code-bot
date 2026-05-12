# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code from server directory
COPY server/ ./server/

# Copy backend directory (needed by runtime)
COPY backend ./backend

# Build TypeScript
WORKDIR /app/server
RUN npm run build
WORKDIR /app
RUN ./node_modules/.bin/tsc backend/Engine.ts backend/UI.ts --module commonjs --target ES2020 --moduleResolution node --esModuleInterop --skipLibCheck --outDir backend

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/server/dist ./server/dist

# Copy backend directory (needed by runtime)
COPY --from=builder /app/backend ./backend

# Expose port
EXPOSE 3004

# Set environment variable
ENV ENGINE_MANAGER_PORT=3004

# Run the application
CMD ["node", "server/dist/engineManager.js"]
