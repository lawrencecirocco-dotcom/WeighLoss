# Build locally or on a Docker-capable host. Render's blueprint uses native Node.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NODE_USE_ENV_PROXY=1 \
    HOST=0.0.0.0 \
    PORT=10000 \
    DATA_DIR=/var/data/lighter
WORKDIR /app
# tsx is the app's runtime entrypoint, so retain the lockfile-installed modules.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
RUN mkdir -p /var/data/lighter && chown -R node:node /var/data/lighter
USER node
EXPOSE 10000
# A mounted disk must be writable by the container's node user (uid 1000).
CMD ["npm", "start"]
