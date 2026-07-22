# 삼단오목 병행 구축 가정

1. 기존 5개 게임은 현재 URL과 API를 유지한다.
2. 삼단오목은 별도 Fastify 서버와 React 앱으로 구성하며, 레거시 Hono 프로세스와 별도 포트/배포 단위를 사용한다.
3. 운영에서 동일한 공개 URL의 `/threemok` 경로를 제공하려면 Azure Front Door 또는 동등한 path-based reverse proxy가 필요하다. 로컬에서는 `THREE_MOK_PUBLIC_URL`로 새 앱 주소를 지정한다.
4. 기존 Node.js 22 이상과 호환되는 TypeScript/패키지 버전을 사용한다. 현재 실행 환경의 Node.js가 24인 경우에도 Node 22 호환성을 우선한다.
5. Google 로그인은 개발 환경에서 명시적으로 비활성화할 수 있으나 production에서 익명 우회가 켜지지 않도록 startup validation을 둔다.
6. 경기 상태의 authoritative snapshot과 append-only 이벤트는 PostgreSQL/Prisma에 저장한다. 게임 엔진은 DB와 시간을 직접 참조하지 않는다.
7. 무승부 라운드 재시작 시 해당 라운드의 초기 돌 재고를 복원하고, 같은 라운드 번호와 색 배정을 유지한다.
8. 2라운드부터 직전 라운드 패자가 색을 선택하고, 선택이 끝난 뒤 두 플레이어가 다시 Ready해야 다음 라운드를 시작한다.
9. 관전자는 로그인 사용자이며 PLAYER 좌석을 차지하지 않고 읽기 전용 snapshot만 받는다.
10. 운영 배포 파일은 작성하되 Azure 리소스 생성과 실제 배포는 사용자 승인 전 실행하지 않는다.

