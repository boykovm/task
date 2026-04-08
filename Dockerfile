# Stage 1: Build
FROM node:22.15.1-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

copy prisma ./prisma
copy lib ./lib
RUN npx prisma generate

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production
FROM node:22.15.1-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

copy prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY lib ./lib

EXPOSE 3000

CMD ["node", "dist/src/index.js"]

