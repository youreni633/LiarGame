FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @three-level-omok/game-engine build
RUN pnpm --filter @three-level-omok/contracts build
RUN pnpm --filter @three-level-omok/db exec prisma generate
RUN pnpm --filter @three-level-omok/db build
RUN pnpm --filter @three-level-omok/server build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/game-engine ./packages/game-engine
COPY --from=build /workspace/packages/contracts ./packages/contracts
COPY --from=build /workspace/packages/db ./packages/db
COPY --from=build /workspace/apps/three-level-omok/server ./apps/three-level-omok/server
EXPOSE 3100
CMD ["node", "apps/three-level-omok/server/dist/server.js"]
