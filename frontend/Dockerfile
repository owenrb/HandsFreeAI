# Build stage
FROM node:22-slim AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

# Copy source code
COPY . .

# Build the project (generates /app/dist)
RUN npm run build

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Copy built files and server code
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.ts ./server.ts

# Install tsx to run the server.ts
RUN npm install -g tsx

# Set environment variables
ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

# Command to run the Express server
CMD ["tsx", "server.ts"]

