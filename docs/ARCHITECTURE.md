# 병행 플랫폼 아키텍처

## 경계

```text
Legacy Hono app (기존 보존)
  src/index.ts
  src/DeathNote/
  src/YangSeChan/
  src/ForbiddenWord/
  src/Spyfall/
  src/CatchMind/

New Three-Level Omok platform (신규 격리)
  apps/three-level-omok/web       React + Vite
  apps/three-level-omok/server    Fastify + Socket.IO
  packages/game-engine             순수 규칙 엔진
  packages/contracts               Zod/API/Socket 계약
  packages/db                      Prisma schema/repository
```

기존 서버는 현재 포트와 API를 유지한다. 신규 Fastify 서버는 별도 포트에서 실행하며, 운영 공개 계층에서 `/threemok`을 신규 앱으로 라우팅한다. 이 방식은 레거시 게임의 메모리 방 상태와 신규 플랫폼의 PostgreSQL 상태를 섞지 않는다.

## 요청 흐름

```text
React client
  ├─ REST command → Fastify → session/membership/Zod
  ├─ Socket.IO → auth middleware → room membership
  └─ snapshot render

Fastify command handler
  → ProcessedCommand 중복 검사
  → expectedRevision compare-and-swap
  → Prisma transaction
  → pure game-engine apply
  → Match snapshot + GameEvent append
  → Socket.IO room broadcast
```

## 라우팅

- 레거시 `/`, `/deathnote`, `/yangsechan`, `/forbidden-word`, `/spyfall`, `/catchmind`는 변경하지 않는다.
- 레거시 메인 화면의 삼단오목 버튼은 환경별 `THREE_MOK_PUBLIC_URL`로 이동한다.
- 운영에서는 Front Door/Reverse Proxy에서 `/threemok*`과 `/api/omok*`을 신규 앱으로 보낸다.
- 신규 앱은 내부적으로 `/threemok` 페이지와 `/api/omok` API를 제공한다.

## 데이터 원칙

- 게임 엔진은 네트워크, DB, 시계, 난수, 환경변수에 의존하지 않는다.
- 서버가 시간과 보안 난수를 엔진 입력으로 제공한다.
- `revision`과 `expectedRevision`으로 동시 명령을 직렬화한다.
- `commandId`는 `ProcessedCommand` unique 제약으로 중복 처리를 막는다.
- `GameEvent`는 복기/장애 분석을 위한 append-only 로그다.
- 세션 토큰 원문은 저장하지 않고 hash만 저장한다.

