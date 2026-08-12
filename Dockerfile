# Node 20 rather than 22: Next 16 needs >=20.9, and the Unraid host already
# has this base image, which saves a pull on a box that's usually I/O bound.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/config

# `output: "standalone"` bundles only the server and the node_modules it
# actually uses; public/ and .next/static aren't included, so copy them in.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Runs as root like the rest of the *arr stack, so it can write to an Unraid
# appdata mount without the host directory needing its ownership changed.
VOLUME /config
EXPOSE 3000
CMD ["node", "server.js"]
