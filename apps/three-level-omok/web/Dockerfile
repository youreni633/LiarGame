FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @three-level-omok/game-engine build
RUN pnpm --filter @three-level-omok/contracts build
RUN pnpm --filter @three-level-omok/web build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/three-level-omok/web/dist /usr/share/nginx/html/threemok
EXPOSE 8080
