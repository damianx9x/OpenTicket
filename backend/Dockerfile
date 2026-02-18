# Base image
FROM node:18-slim

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# Use package-lock.json to ensure reproducible builds
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Generate prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Expose port and start app
EXPOSE 3000
CMD ["node", "dist/main.js"]

