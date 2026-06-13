# Build stage
FROM --platform=linux/amd64 node:22-slim AS build

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM --platform=linux/amd64 node:22-slim AS production

WORKDIR /app

# Copy only the necessary files from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port the app runs on
EXPOSE 8080

# Command to run the app
CMD ["node", "dist/server.js"]
