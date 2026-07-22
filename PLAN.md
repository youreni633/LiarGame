# Three-Level Omok 병행 구축 계획

## 범위 원칙

- 기존 `src/` 기반 Hono 게임 서버와 5개 게임은 동작 코드를 변경하지 않는다.
- 새 플랫폼은 `apps/three-level-omok`과 `packages/*` 아래에 격리한다.
- 레거시 메인 페이지에는 삼단오목 진입 링크만 최소 변경한다.
- Azure 리소스 생성, GitHub push, 실제 production 배포는 실행하지 않는다.

## 작업 체크리스트

- [x] 기존 저장소와 레거시 경계 확인
- [x] 병행 구축 라우팅/배포 경계 결정
- [x] 순수 게임 엔진 타입과 오류 코드 작성
- [x] 기본 배치/새 돌/이동/승리/시간초과/강제패스 구현
- [x] Vitest 및 property test 작성
- [x] Fastify API와 Socket.IO 계약 구현
- [x] Prisma schema와 repository/이벤트 로그 구현
- [x] Google 인증/세션 경계 구현
- [x] React/Vite 로비/대기실/게임/관전자/결과 화면 구현
- [x] 재접속 snapshot 및 서버 타이머 reconciliation 구현
- [x] 레거시 메인 페이지의 삼단오목 진입 링크 연결
- [x] Docker Compose/PostgreSQL 로컬 환경 작성
- [x] Dockerfile과 로컬 컨테이너 구성 작성
- [ ] Docker image build 검증 (Docker Desktop daemon 미실행)
- [ ] Azure Bicep/배포 문서 작성 (Azure 준비 승인 후 진행)
- [x] GitHub Actions CI workflow 작성
- [x] typecheck/unit/API/build 검증

## 검증 기록

| 단계 | 명령 | 결과 |
|---|---|---|
| 기존 레거시 빌드 | `npm run build` | 통과 |
| 신규 계약/엔진/DB/서버 빌드 | `pnpm --filter ... build` | 통과 |
| 신규 엔진 테스트 | `pnpm --filter @three-level-omok/game-engine test` | 2 files, 8 tests 통과 |
| 신규 웹 빌드 | `pnpm --filter @three-level-omok/web build` | Vite production build 통과 |
| 서버 API smoke test | `node --input-type=module -e ...` | `/health` 200, 개발 인증 200 |
| Compose 구문 | `docker compose config` | 통과 |
