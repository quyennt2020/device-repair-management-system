FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY services/customer-service/package*.json ./
COPY shared/types/package*.json ./shared/types/
COPY shared/database/package*.json ./shared/database/

# Install dependencies
RUN npm install

# Copy shared modules
COPY shared/ ./shared/

# Copy service source
COPY services/customer-service/ ./

# Build the application
RUN npm run build

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

# Start the application
CMD ["npm", "start"]