export function getCatchMindHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>캐치마인드</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #020617;
      --panel: rgba(15, 23, 42, 0.88);
      --panel-soft: rgba(15, 23, 42, 0.76);
      --line: rgba(148, 163, 184, 0.16);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --brand-a: #f97316;
      --brand-b: #06b6d4;
      --green: #22c55e;
      --red: #ef4444;
      --amber: #f59e0b;
      --radius: 22px;
      --radius-sm: 14px;
      --shadow: 0 24px 64px rgba(0, 0, 0, 0.36);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Noto Sans KR", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(249, 115, 22, 0.16), transparent 22%),
        radial-gradient(circle at bottom right, rgba(6, 182, 212, 0.18), transparent 24%),
        var(--bg);
      color: var(--text);
    }

    button, input, select, textarea { font: inherit; }

    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }

    .lobby {
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .wrap {
      width: 100%;
      max-width: 1140px;
      display: grid;
      gap: 20px;
      grid-template-columns: 360px 1fr;
    }

    .card,
    .block {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(14px);
    }

    .brand h1 {
      margin: 0;
      font-size: 38px;
      letter-spacing: -0.03em;
    }

    .brand p {
      color: var(--muted);
      line-height: 1.7;
      margin-top: 10px;
    }

    .small {
      font-size: 12px;
      color: var(--muted);
    }

    .small a {
      color: inherit;
      text-decoration: none;
    }

    .label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .stack { display: grid; gap: 14px; }

    .row {
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr 1fr;
    }

    input, select, textarea {
      width: 100%;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      outline: none;
    }



    input:focus, select:focus, textarea:focus {
      border-color: rgba(6, 182, 212, 0.7);
      box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12);
    }

    button {
      border: none;
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      cursor: pointer;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      color: white;
      font-weight: 700;
      transition: transform 0.15s ease, opacity 0.15s ease;
      touch-action: manipulation;
    }

    button.secondary {
      background: #1e293b;
      color: var(--text);
    }

    button.danger {
      background: linear-gradient(135deg, #ef4444, #991b1b);
    }

    button.warning {
      background: linear-gradient(135deg, #f59e0b, #ea580c);
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }

    button:not(:disabled):active {
      transform: scale(0.98);
    }

    .room-list {
      display: grid;
      gap: 12px;
      max-height: 620px;
      overflow: auto;
    }

    .room-item {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      padding: 16px;
      background: var(--panel-soft);
      cursor: pointer;
      touch-action: manipulation;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .room-item:hover {
      border-color: rgba(6, 182, 212, 0.5);
      transform: translateY(-1px);
    }

    .room-item.disabled {
      opacity: 0.48;
      cursor: not-allowed;
      transform: none;
    }

    .room-item h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #cbd5e1;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.14);
      border: 1px solid rgba(6, 182, 212, 0.22);
      font-size: 12px;
      color: #d5f5fb;
      white-space: nowrap;
    }

    .badge.warn {
      background: rgba(249, 115, 22, 0.14);
      border-color: rgba(249, 115, 22, 0.22);
      color: #ffedd5;
    }

    .badge.danger {
      background: rgba(239, 68, 68, 0.14);
      border-color: rgba(239, 68, 68, 0.22);
      color: #fecaca;
    }

    .empty {
      padding: 24px;
      text-align: center;
      color: var(--muted);
      border: 1px dashed rgba(148, 163, 184, 0.2);
      border-radius: 18px;
    }

    .game {
      display: none;
      min-height: 100vh;
      flex-direction: column;
    }

    .game.active { display: flex; }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: rgba(2, 6, 23, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      backdrop-filter: blur(12px);
    }

    .topbar h2 {
      margin: 0;
      font-size: 24px;
    }

    .topbar-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mobile-tabs {
      display: none;
      gap: 8px;
      padding: 10px 16px 0;
      background: rgba(2, 6, 23, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .mobile-tab {
      flex: 1;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.8);
      color: #cbd5e1;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
    }

    .mobile-tab.active {
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      color: white;
      border-color: transparent;
    }

    .game-body {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) 360px 280px;
      min-height: 0;
    }

    .panel {
      overflow: auto;
      padding: 18px;
    }

    .game-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chat-panel {
      border-left: 1px solid rgba(148, 163, 184, 0.12);
      border-right: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(2, 6, 23, 0.22);
    }

    .status-panel {
      background: rgba(2, 6, 23, 0.14);
    }

    .hero {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.16), rgba(6, 182, 212, 0.18));
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 22px;
      padding: 20px;
    }

    .hero-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .hero h3 {
      margin: 6px 0 8px;
      font-size: 28px;
      letter-spacing: -0.03em;
    }

    .hero-text {
      color: #e2e8f0;
      line-height: 1.65;
      white-space: pre-wrap;
    }

    .timer-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 88px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.76);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 15px;
      font-weight: 800;
      color: #f8fafc;
    }

    .timer-pill.warning {
      color: #fed7aa;
      border-color: rgba(249, 115, 22, 0.3);
      background: rgba(124, 45, 18, 0.44);
    }

    .block-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .block-head h3,
    .block h3 {
      margin: 0;
      font-size: 17px;
    }

    .role-note {
      font-size: 13px;
      color: var(--muted);
    }

    .toolbar {
      display: grid;
      gap: 12px;
      margin-bottom: 14px;
    }

    .tool-row,
    .color-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .tool-btn,
    .color-btn {
      min-width: 42px;
      height: 42px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0;
      font-weight: 700;
    }

    .tool-btn.active,
    .color-btn.active {
      border-color: rgba(255, 255, 255, 0.22);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      outline: 2px solid rgba(6, 182, 212, 0.36);
    }

    .color-btn {
      width: 34px;
      min-width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 999px;
    }

    .size-box {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 13px;
    }

    .size-box input[type="range"] {
      accent-color: var(--brand-b);
      padding: 0;
      background: transparent;
      border: none;
    }

    .toolbar.disabled {
      opacity: 0.52;
      pointer-events: none;
    }

    .canvas-shell {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid rgba(148, 163, 184, 0.22);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
      cursor: crosshair;
    }

    .canvas-shell.readonly canvas {
      cursor: default;
      touch-action: auto;
    }

    .canvas-overlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.44);
      color: white;
      font-size: 16px;
      font-weight: 700;
      backdrop-filter: blur(4px);
    }

    .messages {
      max-height: 58vh;
      overflow: auto;
      margin-bottom: 14px;
      padding-right: 2px;
    }

    .chat-line {
      padding: 5px 0;
      color: #e2e8f0;
      line-height: 1.55;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .chat-line strong {
      color: #fed7aa;
    }

    .chat-line.system {
      color: #bae6fd;
      font-weight: 700;
    }

    .chat-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }

    .players {
      display: grid;
      gap: 10px;
    }

    .player-card {
      padding: 12px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.14);
      display: grid;
      gap: 6px;
    }

    .player-card.drawer {
      border-color: rgba(249, 115, 22, 0.36);
      box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.12);
    }

    .player-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .player-name {
      font-weight: 700;
    }

    .player-sub {
      color: var(--muted);
      font-size: 12px;
    }

    .result-card {
      display: none;
      padding: 20px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(6, 182, 212, 0.18));
      border: 1px solid rgba(255, 255, 255, 0.08);
      line-height: 1.7;
    }

    .result-card.show {
      display: block;
    }

    .result-card h3 {
      margin: 0 0 10px;
      font-size: 22px;
    }

    .rank-list {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .rank-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .lobby-info {
      color: var(--muted);
      line-height: 1.7;
      font-size: 14px;
    }

    .toast-stack {
      position: fixed;
      right: 16px;
      bottom: max(16px, env(safe-area-inset-bottom));
      display: grid;
      gap: 10px;
      z-index: 30;
    }

    .toast {
      min-width: 220px;
      max-width: 320px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.16);
      color: #f8fafc;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.28);
    }

    .toast.error {
      border-color: rgba(239, 68, 68, 0.32);
      color: #fecaca;
    }

    .toast.success {
      border-color: rgba(34, 197, 94, 0.32);
      color: #dcfce7;
    }

    @media (max-width: 1024px) {
      .wrap,
      .game-body {
        grid-template-columns: 1fr;
      }

      .mobile-tabs { display: flex; }
      .chat-panel, .status-panel { border: none; }
      .game-body.mobile-game .chat-panel,
      .game-body.mobile-game .status-panel { display: none; }
      .game-body.mobile-chat .game-panel,
      .game-body.mobile-chat .status-panel { display: none; }
      .game-body.mobile-status .game-panel,
      .game-body.mobile-status .chat-panel { display: none; }
      .topbar {
        flex-direction: column;
        align-items: flex-start;
      }
      .topbar-actions { width: 100%; }
      .topbar-actions button { flex: 1; }
      .row {
        grid-template-columns: 1fr;
      }
      .room-list {
        max-height: 40vh;
      }
      .hero-row {
        flex-direction: column;
      }
      .game-body {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <section class="card">
        <div class="brand">
          <div class="small"><a href="/">메인으로 돌아가기</a></div>
          <h1>캐치마인드</h1>
          <p>한 명은 그림으로 제시어를 설명하고, 나머지는 채팅으로 정답을 맞히는 실시간 드로잉 게임입니다. 출제자만 그릴 수 있고, 정답을 먼저 맞히면 즉시 다음 턴으로 넘어갑니다.</p>
        </div>
        <form id="create-room-form">
        <div class="stack" style="margin-top:18px;">
          <div>
            <label class="label">닉네임</label>
            <input id="nickname-input" maxlength="10" placeholder="닉네임을 입력해 주세요" enterkeyhint="next" autocomplete="nickname" />
          </div>
          <div>
            <label class="label">방 이름</label>
            <input id="room-name-input" maxlength="24" placeholder="방 이름(선택)" enterkeyhint="go" autocomplete="off" />
          </div>
          <div class="row">
            <div>
              <label class="label">최대 인원</label>
              <select id="max-players-select">
                <option value="4">4명</option>
                <option value="6" selected>6명</option>
                <option value="8">8명</option>
                <option value="10">10명</option>
              </select>
            </div>
            <div>
              <label class="label">라운드 수</label>
              <select id="rounds-select">
                <option value="1" selected>1라운드</option>
                <option value="2">2라운드</option>
                <option value="3">3라운드</option>
                <option value="5">5라운드</option>
              </select>
            </div>
          </div>
          <div>
            <label class="label">턴 시간</label>
            <select id="turn-duration-select">
              <option value="60">60초</option>
              <option value="90">90초</option>
              <option value="120" selected>120초</option>
              <option value="150">150초</option>
            </select>
          </div>
          <button id="create-room-btn" type="submit">캐치마인드 방 만들기</button>
        </div>
        </form>
      </section>
      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;">
          <h2 style="margin:0;font-size:20px;">입장 가능한 방</h2>
          <button id="refresh-btn" class="secondary">새로고침</button>
        </div>
        <div id="room-list" class="room-list"></div>
      </section>
    </div>
  </div>

  <div id="game-screen" class="game">
    <div class="topbar">
      <div>
        <div id="room-phase" class="small">로비</div>
        <h2 id="room-title">캐치마인드</h2>
      </div>
      <div class="topbar-actions">
        <button id="ready-btn" class="secondary">준비</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>
    <div class="mobile-tabs">
      <button class="mobile-tab active" data-tab="game">게임</button>
      <button class="mobile-tab" data-tab="chat">채팅</button>
      <button class="mobile-tab" data-tab="status">상태</button>
    </div>
    <div id="game-body" class="game-body mobile-game">
      <div class="panel game-panel">
        <div class="hero">
          <div class="hero-row">
            <div>
              <div id="round-label" class="small">라운드 정보</div>
              <h3 id="word-display">게임을 준비하는 중입니다.</h3>
              <div id="status-text" class="hero-text">방장과 플레이어들이 준비를 마치면 게임을 시작할 수 있습니다.</div>
            </div>
            <div id="timer-pill" class="timer-pill" style="display:none;">02:00</div>
          </div>
        </div>

        <div id="lobby-panel" class="block"></div>

        <div class="block">
          <div class="block-head">
            <h3>그림판</h3>
            <div id="board-role-note" class="role-note">출제자만 그림을 그릴 수 있습니다.</div>
          </div>
          <div id="toolbar" class="toolbar">
            <div class="tool-row">
              <button type="button" class="tool-btn active" data-tool="pen">펜</button>
              <button type="button" class="tool-btn" data-tool="eraser">지우개</button>
              <button type="button" id="clear-canvas-btn" class="tool-btn">전체 지우기</button>
            </div>
            <div class="color-row">
              <button type="button" class="color-btn active" data-color="#111827" style="background:#111827;"></button>
              <button type="button" class="color-btn" data-color="#ef4444" style="background:#ef4444;"></button>
              <button type="button" class="color-btn" data-color="#f59e0b" style="background:#f59e0b;"></button>
              <button type="button" class="color-btn" data-color="#22c55e" style="background:#22c55e;"></button>
              <button type="button" class="color-btn" data-color="#06b6d4" style="background:#06b6d4;"></button>
              <button type="button" class="color-btn" data-color="#8b5cf6" style="background:#8b5cf6;"></button>
            </div>
            <div class="size-box">
              <span>굵기</span>
              <input id="brush-size-input" type="range" min="2" max="24" value="4" />
              <strong id="brush-size-label">4px</strong>
            </div>
          </div>
          <div id="canvas-shell" class="canvas-shell">
            <canvas id="draw-canvas"></canvas>
            <div id="canvas-overlay" class="canvas-overlay"></div>
          </div>
        </div>

        <div id="result-panel" class="result-card"></div>
      </div>

      <div class="panel chat-panel">
        <div class="block">
          <div class="block-head">
            <h3>채팅</h3>
            <div class="role-note">정답은 채팅으로 입력해 주세요.</div>
          </div>
          <div id="chat-messages" class="messages"></div>
          <form id="chat-form">
            <div class="chat-row">
              <input id="chat-input" type="text" placeholder="메시지 입력 (정답도 이곳에)" enterkeyhint="send" autocomplete="off" />
              <button type="submit">전송</button>
            </div>
          </form>
        </div>
      </div>

      <div class="panel status-panel">
        <div class="block">
          <div class="block-head">
            <h3>플레이어</h3>
            <div id="player-summary" class="role-note">0명</div>
          </div>
          <div id="player-list" class="players"></div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast-stack" class="toast-stack"></div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const state = {
      nickname: localStorage.getItem("cm:nickname") || "",
      roomId: localStorage.getItem("cm:roomId") || "",
      playerId: localStorage.getItem("cm:playerId") || "",
      version: 0,
      room: null,
      myState: null,
      players: [],
      messages: [],
      drawEvents: [],
      drawVersion: 0,
      resultEntries: [],
      rooms: [],
      socket: null,
      socketJoined: false,
      mobileTab: "game",
      tool: "pen",
      color: "#111827",
      brushSize: 4,
      isDrawing: false,
      lastPoint: null,
      strokeMoved: false,
      ctx: null,
      canvasTurnKey: "",
      canvasSyncPending: false,
      roomRefreshHandle: null,
      timerHandle: null,
      lastMessageCount: 0,
    };

    const els = {
      lobbyScreen: document.getElementById("lobby-screen"),
      gameScreen: document.getElementById("game-screen"),
      roomList: document.getElementById("room-list"),
      nicknameInput: document.getElementById("nickname-input"),
      roomNameInput: document.getElementById("room-name-input"),
      maxPlayersSelect: document.getElementById("max-players-select"),
      roundsSelect: document.getElementById("rounds-select"),
      turnDurationSelect: document.getElementById("turn-duration-select"),
      createRoomBtn: document.getElementById("create-room-btn"),
      refreshBtn: document.getElementById("refresh-btn"),
      roomPhase: document.getElementById("room-phase"),
      roomTitle: document.getElementById("room-title"),
      readyBtn: document.getElementById("ready-btn"),
      startBtn: document.getElementById("start-btn"),
      leaveBtn: document.getElementById("leave-btn"),
      gameBody: document.getElementById("game-body"),
      roundLabel: document.getElementById("round-label"),
      wordDisplay: document.getElementById("word-display"),
      statusText: document.getElementById("status-text"),
      timerPill: document.getElementById("timer-pill"),
      lobbyPanel: document.getElementById("lobby-panel"),
      boardRoleNote: document.getElementById("board-role-note"),
      toolbar: document.getElementById("toolbar"),
      canvasShell: document.getElementById("canvas-shell"),
      canvas: document.getElementById("draw-canvas"),
      canvasOverlay: document.getElementById("canvas-overlay"),
      clearCanvasBtn: document.getElementById("clear-canvas-btn"),
      brushSizeInput: document.getElementById("brush-size-input"),
      brushSizeLabel: document.getElementById("brush-size-label"),
      chatMessages: document.getElementById("chat-messages"),
      chatForm: document.getElementById("chat-form"),
      chatInput: document.getElementById("chat-input"),
      playerSummary: document.getElementById("player-summary"),
      playerList: document.getElementById("player-list"),
      resultPanel: document.getElementById("result-panel"),
      toastStack: document.getElementById("toast-stack"),
      mobileTabs: Array.from(document.querySelectorAll(".mobile-tab")),
      toolButtons: Array.from(document.querySelectorAll(".tool-btn[data-tool]")),
      colorButtons: Array.from(document.querySelectorAll(".color-btn")),
    };

    const phaseLabels = {
      lobby: "로비",
      turn: "그림 맞히기",
      turn_result: "턴 결과",
      result: "최종 결과",
    };

    const roleLabels = {
      host: "방장",
      drawer: "출제자",
      guesser: "정답자",
    };

    const MIN_DRAW_DISTANCE = 0.0025;

    function showToast(message, type = "") {
      const toast = document.createElement("div");
      toast.className = "toast" + (type ? " " + type : "");
      toast.textContent = message;
      els.toastStack.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 220);
      }, 2800);
    }

    function escapeHtml(value) {
      const div = document.createElement("div");
      div.textContent = String(value ?? "");
      return div.innerHTML;
    }

    function saveSession() {
      localStorage.setItem("cm:nickname", state.nickname || "");
      if (state.roomId) {
        localStorage.setItem("cm:roomId", state.roomId);
      } else {
        localStorage.removeItem("cm:roomId");
      }
      if (state.playerId) {
        localStorage.setItem("cm:playerId", state.playerId);
      } else {
        localStorage.removeItem("cm:playerId");
      }
    }

    function disconnectSocket() {
      if (!state.socket) {
        return;
      }
      state.socket.disconnect();
      state.socket = null;
      state.socketJoined = false;
    }

    function clearSession() {
      disconnectSocket();
      state.roomId = "";
      state.playerId = "";
      state.version = 0;
      state.room = null;
      state.myState = null;
      state.players = [];
      state.messages = [];
      state.drawEvents = [];
      state.drawVersion = 0;
      state.resultEntries = [];
      state.socketJoined = false;
      state.canvasTurnKey = "";
      state.canvasSyncPending = false;
      state.isDrawing = false;
      state.lastPoint = null;
      state.strokeMoved = false;
      saveSession();
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "요청 처리 중 오류가 발생했습니다.");
      }
      return data;
    }

    function showLobby() {
      els.lobbyScreen.classList.add("active");
      els.gameScreen.classList.remove("active");
    }

    function showGame() {
      els.gameScreen.classList.add("active");
      els.lobbyScreen.classList.remove("active");
    }

    async function loadRooms() {
      try {
        const data = await api("/api/catchmind/rooms");
        state.rooms = data.rooms || [];
        renderRoomList();
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function renderRoomList() {
      if (!state.rooms.length) {
        els.roomList.innerHTML = '<div class="empty">아직 생성된 방이 없습니다. 새 방을 만들어 첫 게임을 시작해 보세요.</div>';
        return;
      }

      els.roomList.innerHTML = state.rooms.map((room) => {
        const isJoinable = room.phase === "lobby" && room.playerCount < room.maxPlayers;
        const statusClass = room.phase !== "lobby" ? "danger" : room.playerCount >= room.maxPlayers ? "warn" : "";
        const statusText = room.phase !== "lobby" ? "진행 중" : room.playerCount >= room.maxPlayers ? "정원 마감" : "입장 가능";
        return '<div class="room-item ' + (isJoinable ? "" : "disabled") + '" data-room-id="' + escapeHtml(room.id) + '">' +
          '<h3>' + escapeHtml(room.name) + '</h3>' +
          '<div class="meta">' +
            '<span class="badge ' + statusClass + '">' + statusText + '</span>' +
            '<span class="badge">' + room.playerCount + '/' + room.maxPlayers + '명</span>' +
            '<span class="badge">' + room.maxRounds + '라운드</span>' +
            '<span class="badge">' + room.turnDurationSeconds + '초</span>' +
          '</div>' +
        '</div>';
      }).join("");

      Array.from(els.roomList.querySelectorAll(".room-item")).forEach((item) => {
        item.addEventListener("click", async () => {
          if (item.classList.contains("disabled")) {
            return;
          }
          await joinRoom(item.getAttribute("data-room-id") || "");
        });
      });
    }

    async function createRoom() {
      const nickname = els.nicknameInput.value.trim();
      if (!nickname) {
        els.nicknameInput.focus();
        showToast("닉네임을 먼저 입력해 주세요.", "error");
        return;
      }
      try {
        state.nickname = nickname;
        saveSession();
        const data = await api("/api/catchmind/rooms", {
          method: "POST",
          body: {
            nickname,
            roomName: els.roomNameInput.value.trim(),
            maxPlayers: Number(els.maxPlayersSelect.value),
            maxRounds: Number(els.roundsSelect.value),
            turnDurationSeconds: Number(els.turnDurationSelect.value),
          },
        });
        state.roomId = data.roomId;
        state.playerId = data.playerId;
        state.version = 0;
        saveSession();
        await enterGame();
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function joinRoom(roomId) {
      if (!roomId) {
        return;
      }
      const nickname = els.nicknameInput.value.trim();
      if (!nickname) {
        els.nicknameInput.focus();
        els.nicknameInput.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("닉네임을 먼저 입력해 주세요.", "error");
        return;
      }
      try {
        state.nickname = nickname;
        saveSession();
        const data = await api("/api/catchmind/rooms/" + roomId + "/join", {
          method: "POST",
          body: { nickname },
        });
        state.roomId = data.roomId;
        state.playerId = data.playerId;
        state.version = 0;
        saveSession();
        await enterGame();
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function leaveRoom() {
      const roomId = state.roomId;
      const playerId = state.playerId;
      if (!roomId || !playerId) {
        clearSession();
        showLobby();
        loadRooms();
        return;
      }

      try {
        await api("/api/catchmind/rooms/" + roomId + "/leave", {
          method: "POST",
          body: { playerId },
        });
      } catch (error) {
        showToast(error.message, "error");
        return;
      }

      clearSession();
      showLobby();
      renderRoomList();
      loadRooms();
    }

    async function toggleReady() {
      if (!state.roomId || !state.playerId) {
        return;
      }
      try {
        await api("/api/catchmind/rooms/" + state.roomId + "/ready", {
          method: "POST",
          body: { playerId: state.playerId },
        });
        await loadState();
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function startGame() {
      if (!state.roomId || !state.playerId) {
        return;
      }
      try {
        await api("/api/catchmind/rooms/" + state.roomId + "/start", {
          method: "POST",
          body: { playerId: state.playerId },
        });
        setMobileTab("game");
        await loadState(true, true);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function saveRoomSettings(nextSettings) {
      if (!state.roomId || !state.playerId) {
        return;
      }
      try {
        await api("/api/catchmind/rooms/" + state.roomId + "/settings", {
          method: "POST",
          body: { playerId: state.playerId, ...nextSettings },
        });
        await loadState(true, true);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function connectSocket() {
      if (state.socket) {
        return;
      }

      state.socket = io("/catchmind", {
        transports: ["websocket", "polling"],
      });

      state.socket.on("connect", () => {
        if (state.roomId && state.playerId) {
          state.socket.emit("catchmind:session", {
            roomId: state.roomId,
            playerId: state.playerId,
          });
          state.socketJoined = true;
        }
      });

      state.socket.on("catchmind:state", (payload) => {
        applyState(payload);
      });

      state.socket.on("catchmind:draw-line", (payload) => {
        state.drawEvents.push(payload);
        state.drawVersion += 1;
        drawEvent(payload);
      });

      state.socket.on("catchmind:canvas-clear", (payload) => {
        state.drawEvents = [];
        state.drawVersion = Number(payload && payload.drawVersion) || (state.drawVersion + 1);
        replayCanvas();
      });

      state.socket.on("catchmind:error", (payload) => {
        showToast(payload && payload.message ? payload.message : "오류가 발생했습니다.", "error");
      });

      state.socket.on("disconnect", () => {
        state.socketJoined = false;
      });
    }

    async function loadState(force = false, includeCanvas = false) {
      if (!state.roomId || !state.playerId) {
        return;
      }
      try {
        const version = force ? -1 : state.version;
        const data = await api(
          "/api/catchmind/rooms/" +
            state.roomId +
            "/state?playerId=" +
            encodeURIComponent(state.playerId) +
            "&v=" +
            encodeURIComponent(version) +
            "&canvas=" +
            (includeCanvas ? "1" : "0"),
        );
        if (data.changed !== false) {
          applyState(data);
        }
      } catch (error) {
        showToast(error.message, "error");
        clearSession();
        showLobby();
        loadRooms();
      }
    }

    async function enterGame() {
      showGame();
      connectSocket();
      setMobileTab("game");
      await loadState(true, true);
      if (state.socket && state.socket.connected) {
        state.socket.emit("catchmind:session", {
          roomId: state.roomId,
          playerId: state.playerId,
        });
        state.socketJoined = true;
      }
      resizeCanvas();
    }

    function makeTurnKey(room) {
      if (!room) {
        return "";
      }
      return [room.phase, room.currentRound, room.currentTurn, room.currentDrawerId || ""].join(":");
    }

    function applyState(data) {
      if (!data || data.changed === false) {
        return;
      }

      const previousTurnKey = state.canvasTurnKey;
      const previousMessageCount = state.messages.length;
      const previousDrawVersion = state.drawVersion;
      const hasCanvasSnapshot = Array.isArray(data.drawEvents);

      state.version = data.version || 0;
      state.drawVersion = Number(data.drawVersion || 0);
      state.room = data.room || null;
      state.myState = data.myState || null;
      state.players = data.players || [];
      state.messages = data.messages || [];
      if (hasCanvasSnapshot) {
        state.drawEvents = data.drawEvents || [];
      }
      state.resultEntries = data.resultEntries || [];
      state.canvasTurnKey = makeTurnKey(state.room);
      const turnChanged = state.canvasTurnKey !== previousTurnKey;

      if (turnChanged && !hasCanvasSnapshot) {
        state.drawEvents = [];
      }

      renderAll();

      if (turnChanged || hasCanvasSnapshot) {
        replayCanvas();
      }

      if (!hasCanvasSnapshot && state.drawVersion > previousDrawVersion) {
        syncCanvasState();
      }

      if (state.messages.length > previousMessageCount) {
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      }
    }

    async function syncCanvasState() {
      if (state.canvasSyncPending || !state.roomId || !state.playerId) {
        return;
      }
      state.canvasSyncPending = true;
      try {
        await loadState(true, true);
      } finally {
        state.canvasSyncPending = false;
      }
    }

    function renderAll() {
      renderHeader();
      renderLobbyPanel();
      renderBoardState();
      renderToolbarState();
      renderPlayers();
      renderMessages();
      renderResult();
      updateTimer();
    }

    function renderHeader() {
      const room = state.room;
      const me = state.myState;
      els.roomTitle.textContent = room ? room.name : "캐치마인드";
      els.roomPhase.textContent = room ? (phaseLabels[room.phase] || room.phase) : "로비";
      els.roundLabel.textContent = room && room.totalTurns
        ? "라운드 " + room.currentRound + "/" + room.maxRounds + " · 턴 " + room.currentTurn + "/" + room.totalTurns
        : "게임 시작 전";
      els.wordDisplay.textContent = room ? room.displayWord || "게임 시작 전입니다." : "게임을 준비하는 중입니다.";
      els.statusText.textContent = room ? room.statusText : "방 정보를 불러오는 중입니다.";

      const myPlayer = state.players.find((player) => player.id === me?.id);
      const isHost = !!me && me.isHost;
      const isLobby = room && room.phase === "lobby";
      const canStart = !!room && isLobby && isHost && state.players.length >= 2 && state.players.every((player) => player.ready);

      els.readyBtn.style.display = isLobby && !isHost ? "" : "none";
      els.startBtn.style.display = isLobby && isHost ? "" : "none";
      els.readyBtn.textContent = myPlayer && myPlayer.ready ? "준비 취소" : "준비";
      els.startBtn.disabled = !canStart;
    }

    function renderLobbyPanel() {
      const room = state.room;
      const me = state.myState;
      if (!room) {
        els.lobbyPanel.style.display = "none";
        return;
      }

      if (room.phase !== "lobby") {
        els.lobbyPanel.style.display = "none";
        return;
      }

      els.lobbyPanel.style.display = "";
      const isHost = !!me && me.isHost;
      if (isHost) {
        els.lobbyPanel.innerHTML = '<div class="block-head"><h3>방 설정</h3><div class="role-note">방장이 라운드와 턴 시간을 조절할 수 있습니다.</div></div>' +
          '<div class="row">' +
            '<div><label class="label">최대 인원</label><select id="room-max-players">' +
              [2,3,4,5,6,7,8,9,10].map((value) => '<option value="' + value + '"' + (room.maxPlayers === value ? ' selected' : '') + '>' + value + '명</option>').join("") +
            '</select></div>' +
            '<div><label class="label">라운드 수</label><select id="room-rounds">' +
              [1,2,3,4,5].map((value) => '<option value="' + value + '"' + (room.maxRounds === value ? ' selected' : '') + '>' + value + '라운드</option>').join("") +
            '</select></div>' +
          '</div>' +
          '<div style="margin-top:12px;"><label class="label">턴 시간</label><select id="room-turn-duration">' +
            [30,60,90,120,150,180].map((value) => '<option value="' + value + '"' + (room.turnDurationSeconds === value ? ' selected' : '') + '>' + value + '초</option>').join("") +
          '</select></div>' +
          '<p class="lobby-info" style="margin-top:14px;">모든 플레이어가 준비를 완료하면 방장만 게임을 시작할 수 있습니다.</p>';

        const maxPlayersSelect = document.getElementById("room-max-players");
        const roundsSelect = document.getElementById("room-rounds");
        const durationSelect = document.getElementById("room-turn-duration");
        if (maxPlayersSelect) {
          maxPlayersSelect.addEventListener("change", () => {
            saveRoomSettings({
              maxPlayers: Number(maxPlayersSelect.value),
              maxRounds: Number(roundsSelect.value),
              turnDurationSeconds: Number(durationSelect.value),
            });
          });
        }
        if (roundsSelect) {
          roundsSelect.addEventListener("change", () => {
            saveRoomSettings({
              maxPlayers: Number(maxPlayersSelect.value),
              maxRounds: Number(roundsSelect.value),
              turnDurationSeconds: Number(durationSelect.value),
            });
          });
        }
        if (durationSelect) {
          durationSelect.addEventListener("change", () => {
            saveRoomSettings({
              maxPlayers: Number(maxPlayersSelect.value),
              maxRounds: Number(roundsSelect.value),
              turnDurationSeconds: Number(durationSelect.value),
            });
          });
        }
      } else {
        els.lobbyPanel.innerHTML = '<div class="block-head"><h3>방 설정</h3><div class="role-note">방장이 설정을 변경할 수 있습니다.</div></div>' +
          '<div class="meta">' +
            '<span class="badge">' + room.maxPlayers + '명 방</span>' +
            '<span class="badge">' + room.maxRounds + '라운드</span>' +
            '<span class="badge">' + room.turnDurationSeconds + '초</span>' +
          '</div>' +
          '<p class="lobby-info" style="margin-top:14px;">준비를 완료한 뒤 방장의 시작을 기다려 주세요.</p>';
      }
    }

    function renderBoardState() {
      const room = state.room;
      const me = state.myState;
      const canDraw = !!me && me.canDraw;
      const isDrawer = !!me && me.isDrawer;
      let note = "출제자만 그림을 그릴 수 있습니다.";
      let overlayText = "";
      let showOverlay = false;

      if (!room) {
        note = "방 정보를 불러오는 중입니다.";
        overlayText = "방 상태를 불러오는 중입니다.";
        showOverlay = true;
      } else if (room.phase === "lobby") {
        note = "게임 시작 전입니다.";
        overlayText = "게임이 시작되면 캔버스가 활성화됩니다.";
        showOverlay = true;
      } else if (room.phase === "turn") {
        note = isDrawer
          ? "출제자입니다. 제시어를 그림으로 설명해 주세요."
          : "정답자입니다. 그림을 보고 채팅으로 정답을 맞혀 보세요.";
      } else if (room.phase === "turn_result") {
        note = "이번 턴 결과를 보여주는 중입니다.";
        overlayText = room.revealedWord ? ("정답: " + room.revealedWord) : "다음 턴을 준비하는 중입니다.";
        showOverlay = true;
      } else if (room.phase === "result") {
        note = "최종 결과를 정리하는 중입니다.";
        overlayText = "최종 순위를 집계하는 중입니다.";
        showOverlay = true;
      }

      els.boardRoleNote.textContent = note;
      els.canvasShell.classList.toggle("readonly", !canDraw);
      els.canvasOverlay.style.display = showOverlay ? "flex" : "none";
      els.canvasOverlay.textContent = overlayText;
    }

    function renderToolbarState() {
      const canDraw = !!state.myState && state.myState.canDraw;
      els.toolbar.classList.toggle("disabled", !canDraw);
      els.brushSizeLabel.textContent = state.brushSize + "px";

      els.toolButtons.forEach((button) => {
        button.classList.toggle("active", button.getAttribute("data-tool") === state.tool);
      });

      els.colorButtons.forEach((button) => {
        button.classList.toggle("active", button.getAttribute("data-color") === state.color && state.tool === "pen");
      });
    }

    function renderPlayers() {
      els.playerSummary.textContent = state.players.length + "명";
      if (!state.players.length) {
        els.playerList.innerHTML = '<div class="empty">플레이어 정보가 없습니다.</div>';
        return;
      }

      els.playerList.innerHTML = state.players.map((player) => {
        const isMe = state.myState && player.id === state.myState.id;
        let badges = "";
        if (player.isHost) {
          badges += '<span class="badge">방장</span>';
        }
        if (player.isDrawer) {
          badges += '<span class="badge warn">출제자</span>';
        } else if (state.room && state.room.phase !== "lobby") {
          badges += '<span class="badge">정답자</span>';
        }
        if (!player.connected) {
          badges += '<span class="badge danger">오프라인</span>';
        } else if (state.room && state.room.phase === "lobby" && player.ready) {
          badges += '<span class="badge">준비 완료</span>';
        }
        return '<div class="player-card ' + (player.isDrawer ? "drawer" : "") + '">' +
          '<div class="player-head">' +
            '<div class="player-name">' + escapeHtml(player.nickname) + (isMe ? " (나)" : "") + '</div>' +
            '<div><strong>' + player.score + '점</strong></div>' +
          '</div>' +
          '<div class="player-sub">' + (player.isDrawer ? roleLabels.drawer : roleLabels.guesser) + '</div>' +
          '<div class="meta">' + badges + '</div>' +
        '</div>';
      }).join("");
    }

    function renderMessages() {
      els.chatMessages.innerHTML = state.messages.map((message) => {
        if (message.type === "system") {
          return '<div class="chat-line system">' + escapeHtml(message.text) + '</div>';
        }
        return '<div class="chat-line"><strong>' + escapeHtml(message.nickname) + '</strong> ' + escapeHtml(message.text) + '</div>';
      }).join("");

      if (state.messages.length !== state.lastMessageCount) {
        state.lastMessageCount = state.messages.length;
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      }
    }

    function renderResult() {
      const room = state.room;
      if (!room || room.phase !== "result" || !state.resultEntries.length) {
        els.resultPanel.classList.remove("show");
        els.resultPanel.innerHTML = "";
        return;
      }

      els.resultPanel.classList.add("show");
      els.resultPanel.innerHTML = '<h3>최종 순위</h3>' +
        '<div class="hero-text">모든 출제 순서가 끝났습니다. 잠시 후 자동으로 로비로 돌아갑니다.</div>' +
        '<div class="rank-list">' +
          state.resultEntries.map((entry) => {
            return '<div class="rank-row">' +
              '<div><strong>' + entry.rank + '위</strong> · ' + escapeHtml(entry.nickname) + '</div>' +
              '<div><strong>' + entry.score + '점</strong></div>' +
            '</div>';
          }).join("") +
        '</div>';
    }

    function updateTimer() {
      const room = state.room;
      if (!room || !room.turnEndsAt || room.phase !== "turn") {
        els.timerPill.style.display = "none";
        return;
      }

      const remaining = Math.max(0, room.turnEndsAt - Date.now());
      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      els.timerPill.style.display = "inline-flex";
      els.timerPill.textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
      els.timerPill.classList.toggle("warning", totalSeconds <= 20);
    }

    function setMobileTab(tab) {
      state.mobileTab = tab;
      els.gameBody.classList.remove("mobile-game", "mobile-chat", "mobile-status");
      els.gameBody.classList.add("mobile-" + tab);
      els.mobileTabs.forEach((button) => {
        button.classList.toggle("active", button.getAttribute("data-tab") === tab);
      });
    }

    function resizeCanvas() {
      const rect = els.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      els.canvas.width = Math.round(rect.width * dpr);
      els.canvas.height = Math.round(rect.height * dpr);
      state.ctx = els.canvas.getContext("2d");
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.ctx.lineCap = "round";
      state.ctx.lineJoin = "round";
      replayCanvas();
    }

    function clearCanvasSurface() {
      if (!state.ctx) {
        return;
      }
      const rect = els.canvas.getBoundingClientRect();
      state.ctx.fillStyle = "#ffffff";
      state.ctx.fillRect(0, 0, rect.width, rect.height);
    }

    function drawEvent(event) {
      if (!state.ctx) {
        return;
      }
      const rect = els.canvas.getBoundingClientRect();
      if (event.type === "clear") {
        clearCanvasSurface();
        return;
      }

      const x0 = Number(event.x0) * rect.width;
      const y0 = Number(event.y0) * rect.height;
      const x1 = Number(event.x1) * rect.width;
      const y1 = Number(event.y1) * rect.height;
      const color = event.tool === "eraser" ? "#ffffff" : event.color || "#111827";
      const size = Number(event.size) || 4;
      const isDot = Math.abs(x1 - x0) < 0.001 && Math.abs(y1 - y0) < 0.001;

      state.ctx.save();
      if (isDot) {
        state.ctx.fillStyle = color;
        state.ctx.beginPath();
        state.ctx.arc(x0, y0, Math.max(1, size / 2), 0, Math.PI * 2);
        state.ctx.fill();
      } else {
        state.ctx.strokeStyle = color;
        state.ctx.lineWidth = size;
        state.ctx.beginPath();
        state.ctx.moveTo(x0, y0);
        state.ctx.lineTo(x1, y1);
        state.ctx.stroke();
      }
      state.ctx.restore();
    }

    function replayCanvas() {
      if (!state.ctx) {
        return;
      }
      clearCanvasSurface();
      state.drawEvents.forEach((event) => drawEvent(event));
    }

    function canDraw() {
      return !!state.room && !!state.myState && state.myState.canDraw && state.room.phase === "turn";
    }

    function getClientPoint(event) {
      if (event.touches && event.touches.length > 0) {
        return {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
      if (event.changedTouches && event.changedTouches.length > 0) {
        return {
          x: event.changedTouches[0].clientX,
          y: event.changedTouches[0].clientY,
        };
      }
      return {
        x: event.clientX,
        y: event.clientY,
      };
    }

    function getNormalizedPoint(event) {
      const rect = els.canvas.getBoundingClientRect();
      const point = getClientPoint(event);
      const x = Math.min(1, Math.max(0, (point.x - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (point.y - rect.top) / rect.height));
      return { x, y };
    }

    function distanceBetweenPoints(left, right) {
      if (!left || !right) {
        return 0;
      }
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      return Math.sqrt((dx * dx) + (dy * dy));
    }

    function emitDrawSegment(fromPoint, toPoint) {
      if (!fromPoint || !toPoint) {
        return;
      }

      const payload = {
        roomId: state.roomId,
        playerId: state.playerId,
        x0: fromPoint.x,
        y0: fromPoint.y,
        x1: toPoint.x,
        y1: toPoint.y,
        color: state.color,
        size: state.brushSize,
        tool: state.tool,
      };

      const localEvent = {
        id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        type: "line",
        createdAt: Date.now(),
        ...payload,
      };

      state.drawEvents.push(localEvent);
      state.drawVersion += 1;
      drawEvent(localEvent);
      if (state.socket) {
        state.socket.emit("catchmind:draw-line", payload);
      }
    }

    function startStroke(event) {
      if (!canDraw()) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      state.isDrawing = true;
      state.lastPoint = getNormalizedPoint(event);
      state.strokeMoved = false;
    }

    function moveStroke(event) {
      if (!state.isDrawing || !state.lastPoint || !canDraw()) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }

      const nextPoint = getNormalizedPoint(event);
      if (distanceBetweenPoints(state.lastPoint, nextPoint) < MIN_DRAW_DISTANCE) {
        return;
      }

      emitDrawSegment(state.lastPoint, nextPoint);
      state.strokeMoved = true;
      state.lastPoint = nextPoint;
    }

    function stopStroke(event) {
      const shouldBlockDefault = state.isDrawing && canDraw();
      if (event && event.cancelable && shouldBlockDefault) {
        event.preventDefault();
      }
      if (state.isDrawing && state.lastPoint && !state.strokeMoved && canDraw()) {
        emitDrawSegment(state.lastPoint, state.lastPoint);
      }
      state.isDrawing = false;
      state.lastPoint = null;
      state.strokeMoved = false;
    }

    function clearCanvasByUser() {
      if (!canDraw()) {
        return;
      }
      state.drawEvents = [];
      state.drawVersion += 1;
      replayCanvas();
      if (state.socket) {
        state.socket.emit("catchmind:clear-canvas", {
          roomId: state.roomId,
          playerId: state.playerId,
        });
      }
    }

    function setTool(tool) {
      state.tool = tool;
      renderToolbarState();
    }

    function setColor(color) {
      state.color = color;
      state.tool = "pen";
      renderToolbarState();
    }

    async function sendChat() {
      const text = els.chatInput.value.trim();
      if (!text || !state.socket) {
        return;
      }
      state.socket.emit("catchmind:chat", {
        roomId: state.roomId,
        playerId: state.playerId,
        text,
      });
      els.chatInput.value = "";
    }

    els.nicknameInput.value = state.nickname;
    document.getElementById("create-room-form").addEventListener("submit", (event) => {
      event.preventDefault();
      createRoom();
    });
    els.refreshBtn.addEventListener("click", loadRooms);
    els.readyBtn.addEventListener("click", toggleReady);
    els.startBtn.addEventListener("click", startGame);
    els.leaveBtn.addEventListener("click", leaveRoom);
    els.clearCanvasBtn.addEventListener("click", clearCanvasByUser);
    els.brushSizeInput.addEventListener("input", () => {
      state.brushSize = Number(els.brushSizeInput.value) || 4;
      renderToolbarState();
    });
    els.chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await sendChat();
    });
    els.mobileTabs.forEach((button) => {
      button.addEventListener("click", () => setMobileTab(button.getAttribute("data-tab")));
    });
    els.toolButtons.forEach((button) => {
      button.addEventListener("click", () => setTool(button.getAttribute("data-tool")));
    });
    els.colorButtons.forEach((button) => {
      button.addEventListener("click", () => setColor(button.getAttribute("data-color")));
    });

    els.canvas.addEventListener("mousedown", startStroke);
    els.canvas.addEventListener("mousemove", moveStroke);
    document.addEventListener("mouseup", stopStroke);
    els.canvas.addEventListener("touchstart", startStroke, { passive: false });
    els.canvas.addEventListener("touchmove", moveStroke, { passive: false });
    document.addEventListener("touchend", stopStroke, { passive: false });
    document.addEventListener("touchcancel", stopStroke, { passive: false });

    window.addEventListener("resize", resizeCanvas);
    state.timerHandle = setInterval(updateTimer, 500);
    state.roomRefreshHandle = setInterval(loadRooms, 5000);

    loadRooms();

    if (state.roomId && state.playerId) {
      enterGame();
    } else {
      showLobby();
    }
  </script>
</body>
</html>`;
}
