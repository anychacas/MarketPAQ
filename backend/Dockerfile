# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY prisma ./prisma
# Generate Prisma client into node_modules before compiling TS
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Stage 2: production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# Install prod deps only; @prisma/client is a prod dep so it lands here
RUN npm ci --omit=dev && npm cache clean --force

# Bring the generated Prisma query engine from the build stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Schema is needed by prisma migrate deploy (run separately before startup)
COPY prisma ./prisma

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
