# Build stage
FROM --platform=linux/amd64 node:22-slim AS build

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

# Build the project
RUN npm run build

# Production stage
FROM --platform=linux/amd64 nginx:alpine

# Copy built files from the build stage to nginx's html folder
# Vite builds to the 'dist' directory by default
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom nginx configuration if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
