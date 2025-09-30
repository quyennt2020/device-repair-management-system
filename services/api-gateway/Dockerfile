FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY services/api-gateway/package*.json ./
COPY shared/types/package*.json ./shared/types/

# Install dependencies
RUN npm ci --only=production

# Copy shared types
COPY shared/types ./shared/types

# Copy source code
COPY services/api-gateway/src ./src
COPY services/api-gateway/tsconfig.json ./

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]