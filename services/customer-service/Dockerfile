# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package.json files
COPY package.json .
COPY package-lock.json .
COPY services/customer-service/package.json ./services/customer-service/
COPY services/contract-service/package.json ./services/contract-service/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/case-service/package.json ./services/case-service/
COPY services/data-integration-service/package.json ./services/data-integration-service/
COPY services/device-service/package.json ./services/device-service/
COPY services/document-service/package.json ./services/document-service/
COPY services/inventory-service/package.json ./services/inventory-service/
COPY services/technician-service/package.json ./services/technician-service/
COPY services/workflow-service/package.json ./services/workflow-service/
COPY shared/database/package.json ./shared/database/
COPY shared/types/package.json ./shared/types/
COPY testing/package.json ./testing/
COPY web-app/package.json ./web-app/

# Install all dependencies
RUN npm install --workspaces --legacy-peer-deps

# Stage 2: Runner
FROM node:20-alpine

WORKDIR /app

# Copy only the customer-service package.json
COPY --from=builder /app/services/customer-service/package.json .

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY services/customer-service/ .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

# Start the application
CMD [ "npm", "start" ]
