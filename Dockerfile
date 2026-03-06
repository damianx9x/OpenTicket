# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS backend-deps
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

FROM node:20-bookworm-slim AS frontend-deps
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /build

COPY backend ./backend
COPY frontend ./frontend
COPY --from=backend-deps /build/backend/node_modules ./backend/node_modules
COPY --from=frontend-deps /build/frontend/node_modules ./frontend/node_modules

RUN npm --prefix backend run prisma:generate
RUN npm --prefix backend run build
RUN npm --prefix frontend run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV APP_ENV=SHOP_LOCAL
ENV PORT=3200
WORKDIR /app

COPY --from=builder /build/backend/dist ./backend/dist
COPY --from=builder /build/backend/prisma ./backend/prisma
COPY --from=builder /build/backend/package.json ./backend/package.json
COPY --from=builder /build/backend/node_modules ./backend/node_modules
COPY --from=builder /build/frontend/out ./frontend/out

RUN mkdir -p /var/lib/openticket/data /var/lib/openticket/config /var/log/openticket

EXPOSE 3200
CMD ["node", "/app/backend/dist/main.js"]
