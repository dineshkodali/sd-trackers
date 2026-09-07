# ==========================================
# Stage 1: Build Frontend and Server Bundle
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_URL=https://kxikojvpcyprfbyxsdaa.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd
ARG VITE_AZURE_CLIENT_ID=8902bae4-3763-4455-ae7d-8c7c5aac4011
ARG VITE_AZURE_TENANT_ID=common
ARG VITE_AZURE_REDIRECT_URI=https://kxikojvpcyprfbyxsdaa.supabase.co/auth/v1/callback

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID \
    VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID \
    VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3020 \
    OPEN_BROWSER=false

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server bundle and static frontend assets
COPY --from=builder /app/dist ./dist

# Copy database schema for startup migrations
COPY --from=builder /app/db ./db

EXPOSE 3020

CMD ["node", "dist/server.cjs"]
