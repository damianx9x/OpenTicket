FROM node:18-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
COPY backend/ ./
RUN npm ci --omit=dev
RUN npm run build || true
EXPOSE 3000
CMD ["npm", "start"]
