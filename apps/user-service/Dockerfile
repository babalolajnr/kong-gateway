# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install all dependencies, including devDependencies like typescript
RUN npm install

# Copy all source files
COPY . .

# Build the TypeScript code into the dist/ folder
RUN npm run build

# Stage 2: Production stage
# Using a fresh, lightweight image for the final container
FROM node:22-alpine

WORKDIR /app

# Copy package files again
COPY package*.json ./

# Install ONLY production dependencies to keep the image small and secure
RUN npm install --omit=dev

# Copy the built JavaScript code from the builder stage
COPY --from=builder /app/dist ./dist

# Expose port 3000 which the Fastify server listens on
EXPOSE 3000

# Command to run the application using the built JS files
CMD ["npm", "start"]
