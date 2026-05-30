# Trailog 백엔드 (NestJS) production Dockerfile
#
# pnpm 모노레포 + node-linker=hoisted 조합에서 multi-stage 분리가 까다로워
# 일단 single-stage로 단순화. 이미지 크기는 dev deps 포함이지만 동작 보장.
# (multi-stage 최적화는 학습 노트의 "더 파볼 거리" 참고 — 차후 개선 후보)
#
# 빌드 컨텍스트는 모노레포 루트:
#   docker build -f apps/server/Dockerfile -t trailog-server .

FROM node:22.18.0-alpine

# corepack으로 pnpm 9.9.0 활성 (packageManager 필드와 동일)
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

WORKDIR /repo

# 1) 의존성 그래프 먼저 (docker layer cache 효과)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# 2) 모든 워크스페이스 의존성 install
RUN pnpm install --frozen-lockfile

# 3) 소스 + 빌드
COPY tsconfig*.json turbo.json ./
COPY apps/server ./apps/server
COPY packages/eslint-config ./packages/eslint-config

RUN pnpm --filter @trailog/server build

# 4) 보안: 비특권 사용자로 실행
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /repo

USER nestjs

# 5) server 디렉토리로 이동 + production 환경
WORKDIR /repo/apps/server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# nest build → apps/server/dist/main.js
CMD ["node", "dist/main"]
