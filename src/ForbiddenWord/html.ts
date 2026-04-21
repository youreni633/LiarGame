export function getForbiddenWordHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>금지어 게임</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Noto Sans KR', sans-serif;
      background:
        radial-gradient(circle at top left, rgba(244, 63, 94, 0.16), transparent 22%),
        radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.18), transparent 24%),
        #020617;
      color: #e2e8f0;
    }
    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }
    .lobby { align-items: center; justify-content: center; padding: 24px; }
    .wrap { width: 100%; max-width: 1120px; display: grid; gap: 20px; grid-template-columns: 360px 1fr; }
    .card {
      background: rgba(15, 23, 42, 0.90);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
    }
    .brand h1 { margin: 0; font-size: 38px; letter-spacing: -0.03em; }
    .brand p { color: #94a3b8; line-height: 1.7; }
    .label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    input, textarea, button { font: inherit; }
    input, textarea {
      width: 100%;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 14px;
      padding: 12px 14px;
    }
    textarea { min-height: 120px; resize: vertical; }
    button {
      border: none;
      border-radius: 14px;
      padding: 12px 16px;
      cursor: pointer;
      background: linear-gradient(135deg, #f43f5e, #2563eb);
      color: white;
      font-weight: 700;
    }
    button.secondary { background: #1e293b; }
    button.danger { background: linear-gradient(135deg, #dc2626, #7f1d1d); }
    .room-list { display: grid; gap: 12px; max-height: 600px; overflow: auto; }
    .room-item {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      padding: 16px;
      background: rgba(15, 23, 42, 0.72);
      cursor: pointer;
    }
    .room-item h3 { margin: 0 0 8px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #cbd5e1; }
    .badge {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(96, 165, 250, 0.18);
    }
    .small { font-size: 12px; color: #94a3b8; }
    .stack { display: grid; gap: 14px; }
    .game { display: none; min-height: 100vh; flex-direction: column; }
    .game.active { display: flex; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: rgba(2, 6, 23, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      backdrop-filter: blur(12px);
    }
    .topbar h2 { margin: 0; }
    .topbar-actions { display: flex; gap: 10px; }
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
      background: linear-gradient(135deg, #f43f5e, #2563eb);
      color: white;
      border-color: transparent;
    }
    .game-body {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) 380px 280px;
      min-height: 0;
    }
    .panel { overflow: auto; padding: 18px; }
    .game-panel { display: flex; flex-direction: column; gap: 16px; }
    .chat-panel {
      border-left: 1px solid rgba(148, 163, 184, 0.12);
      border-right: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(2, 6, 23, 0.20);
    }
    .status-panel { background: rgba(2, 6, 23, 0.14); }
    .hero {
      background: linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(59, 130, 246, 0.18));
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 22px;
      padding: 20px;
    }
    .hero h3 { margin: 0 0 8px; font-size: 20px; }
    .hero-text { color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; }
    .block {
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 22px;
      padding: 18px;
    }
    .block h3 { margin: 0 0 12px; font-size: 17px; }
    .status-board, .leaderboard, .players { display: grid; gap: 10px; }
    .status-row, .player, .leader-item {
      padding: 12px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .status-row.out, .player.out { border-color: rgba(248, 113, 113, 0.5); color: #fecaca; }
    .status-word { font-size: 18px; font-weight: 800; margin-top: 6px; }
    .status-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .status-rank { font-size: 12px; color: #94a3b8; }
    .messages {
      max-height: 56vh;
      overflow: auto;
      margin-bottom: 14px;
      padding-right: 4px;
    }
    .chat-line {
      padding: 7px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
      color: #e2e8f0;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chat-line:last-child { border-bottom: none; }
    .chat-line strong { color: #93c5fd; }
    .chat-line.system { color: #fda4af; font-weight: 700; }
    .result-card {
      padding: 18px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(244, 63, 94, 0.18), rgba(59, 130, 246, 0.18));
      border: 1px solid rgba(244, 114, 182, 0.24);
      line-height: 1.7;
    }
    .result-card h3 { margin: 0 0 10px; font-size: 22px; }
    .timer-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(251, 113, 133, 0.2);
      color: #ffe4e6;
      font-size: 13px;
      font-weight: 700;
    }
    .action-note { color: #94a3b8; font-size: 13px; line-height: 1.7; margin-bottom: 12px; }
    .chat-input-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
    .submitted-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.14);
      border: 1px solid rgba(34, 197, 94, 0.24);
      color: #dcfce7;
      font-size: 13px;
      font-weight: 700;
    }
    @media (max-width: 980px) {
      .wrap, .game-body { grid-template-columns: 1fr; }
      .mobile-tabs { display: flex; }
      .chat-panel, .status-panel { border: none; }
      .topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
      .topbar-actions { width: 100%; flex-wrap: wrap; }
      .topbar-actions button { flex: 1; }
      .game-body.mobile-game .chat-panel,
      .game-body.mobile-game .status-panel { display: none; }
      .game-body.mobile-chat .game-panel,
      .game-body.mobile-chat .status-panel { display: none; }
      .game-body.mobile-status .game-panel,
      .game-body.mobile-status .chat-panel { display: none; }
      .chat-input-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <div class="card">
        <div class="brand">
          <div class="small"><a href="/" style="color:inherit;text-decoration:none;">라이어게임으로 돌아가기</a></div>
          <h1>금지어 게임</h1>
          <p>서로에게 금지어를 부여하고, 채팅 중 본인 금지어를 말하는 순간 탈락하는 실시간 심리 게임입니다.</p>
        </div>
        <div class="stack">
          <div><label class="label">닉네임</label><input id="nickname" placeholder="닉네임을 입력하세요" /></div>
          <div><label class="label">방 이름</label><input id="room-name" placeholder="방 이름(선택)" /></div>
          <button id="create-room-btn">금지어 게임 방 만들기</button>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h2 style="margin:0;">참가 가능한 방</h2>
          <button id="refresh-btn" class="secondary">새로고침</button>
        </div>
        <div id="room-list" class="room-list"></div>
      </div>
    </div>
  </div>

  <div id="game-screen" class="game">
    <div class="topbar">
      <div>
        <div class="small" id="room-phase">로비</div>
        <h2 id="room-title">금지어 게임</h2>
      </div>
      <div class="topbar-actions">
        <button id="ready-btn" class="secondary">준비</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>

    <div class="mobile-tabs">
      <button id="tab-game-btn" class="mobile-tab active">게임</button>
      <button id="tab-chat-btn" class="mobile-tab">채팅</button>
      <button id="tab-status-btn" class="mobile-tab">현황</button>
    </div>

    <div id="game-body" class="game-body mobile-game">
      <section class="panel game-panel">
        <div class="hero">
          <h3>현재 진행 상태</h3>
          <div id="status-text" class="hero-text">불러오는 중...</div>
        </div>
        <div id="game-block" class="block"></div>
      </section>

      <section class="panel chat-panel">
        <div class="block" style="height:100%;">
          <h3>채팅 탭</h3>
          <div class="action-note">채팅은 Enter 키로 바로 전송됩니다. 탈락한 플레이어는 관전만 가능합니다.</div>
          <div id="chat-messages" class="messages"></div>
          <form id="chat-form" class="chat-input-row">
            <input id="chat-input" placeholder="메시지를 입력하세요" />
            <button id="send-btn" type="submit">전송</button>
          </form>
        </div>
      </section>

      <aside class="panel status-panel">
        <div class="block">
          <h3>플레이어 현황</h3>
          <div id="player-list" class="players"></div>
        </div>
        <div class="block">
          <h3>탈락 순위</h3>
          <div id="leaderboard" class="leaderboard"></div>
        </div>
      </aside>
    </div>
  </div>

  <script>
    const state = {
      nickname: localStorage.getItem('fw:nickname') || '',
      playerId: localStorage.getItem('fw:playerId') || '',
      roomId: localStorage.getItem('fw:roomId') || '',
      version: 0,
      room: null,
      lastPhase: '',
      mobileTab: 'game',
      poll: null,
    };

    const $ = (id) => document.getElementById(id);
    const escapeHtml = (v) => String(v || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    $('nickname').value = state.nickname;

    function saveIdentity() {
      localStorage.setItem('fw:nickname', state.nickname || '');
      localStorage.setItem('fw:playerId', state.playerId || '');
      localStorage.setItem('fw:roomId', state.roomId || '');
    }

    function showLobby() {
      $('lobby-screen').classList.add('active');
      $('game-screen').classList.remove('active');
    }

    function showGame() {
      $('lobby-screen').classList.remove('active');
      $('game-screen').classList.add('active');
      syncMobileTab();
    }

    function syncMobileTab() {
      const body = $('game-body');
      if (!body) return;
      body.classList.remove('mobile-game', 'mobile-chat', 'mobile-status');
      body.classList.add('mobile-' + state.mobileTab);
      $('tab-game-btn').classList.toggle('active', state.mobileTab === 'game');
      $('tab-chat-btn').classList.toggle('active', state.mobileTab === 'chat');
      $('tab-status-btn').classList.toggle('active', state.mobileTab === 'status');
    }

    function setMobileTab(nextTab) {
      state.mobileTab = nextTab;
      syncMobileTab();
    }

    async function api(url, options = {}) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');
      return data;
    }

    function resetSession(goLobby = true) {
      if (state.poll) clearInterval(state.poll);
      state.poll = null;
      state.roomId = '';
      state.playerId = '';
      state.version = 0;
      state.room = null;
      state.lastPhase = '';
      saveIdentity();
      if (goLobby) {
        showLobby();
        loadRooms();
      }
    }

    async function loadRooms() {
      const data = await api('/api/forbidden-word/rooms');
      const rooms = data.rooms || [];
      $('room-list').innerHTML = rooms.length
        ? rooms.map((room) => \`
          <div class="room-item" onclick="joinRoom('\${room.id}')">
            <h3>\${escapeHtml(room.name)}</h3>
            <div class="meta">
              <span class="badge">\${escapeHtml(room.phase)}</span>
              <span class="badge">\${room.playerCount}/\${room.maxPlayers}</span>
            </div>
          </div>
        \`).join('')
        : '<div class="small">지금 참가 가능한 금지어 게임 방이 없습니다.</div>';
    }

    async function createRoom() {
      state.nickname = $('nickname').value.trim();
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/forbidden-word/rooms', {
        method: 'POST',
        body: JSON.stringify({
          nickname: state.nickname,
          roomName: $('room-name').value.trim(),
        }),
      });
      state.playerId = data.playerId;
      state.roomId = data.roomId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function joinRoom(roomId) {
      state.nickname = $('nickname').value.trim();
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/forbidden-word/rooms/' + roomId + '/join', {
        method: 'POST',
        body: JSON.stringify({ nickname: state.nickname }),
      });
      state.playerId = data.playerId;
      state.roomId = data.roomId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function leaveRoom() {
      if (!state.roomId || !state.playerId) return resetSession(true);
      try {
        await api('/api/forbidden-word/rooms/' + state.roomId + '/leave', {
          method: 'POST',
          body: JSON.stringify({ playerId: state.playerId }),
        });
      } catch (_) {}
      resetSession(true);
    }

    async function toggleReady() {
      await api('/api/forbidden-word/rooms/' + state.roomId + '/ready', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId }),
      });
    }

    async function startGame() {
      await api('/api/forbidden-word/rooms/' + state.roomId + '/start', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId }),
      });
      setMobileTab('game');
    }

    async function submitWord() {
      const input = $('assignment-word');
      const word = input.value.trim();
      if (!word) return;
      await api('/api/forbidden-word/rooms/' + state.roomId + '/word', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, word }),
      });
      input.value = '';
    }

    async function sendChat() {
      const input = $('chat-input');
      const text = input.value.trim();
      if (!text) return;
      await api('/api/forbidden-word/rooms/' + state.roomId + '/chat', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, text }),
      });
      input.value = '';
    }

    function renderGameBlock(data) {
      const room = data.room;
      const me = data.myState;
      const isHost = room.hostId === state.playerId;
      $('ready-btn').style.display = room.phase === 'lobby' ? 'inline-flex' : 'none';
      $('start-btn').style.display = isHost && room.phase === 'lobby' ? 'inline-flex' : 'none';
      $('ready-btn').textContent = me && me.ready ? '준비 완료' : '준비';
      $('ready-btn').disabled = room.phase !== 'lobby';

      if (room.phase === 'lobby') {
        $('game-block').innerHTML = \`
          <h3>게임 준비</h3>
          <div class="action-note">2명부터 10명까지 참가할 수 있습니다. 모두 준비되면 방장이 시작할 수 있습니다.</div>
          <div class="small">현재 준비 인원: \${(data.players || []).filter((player) => player.ready).length}/\${(data.players || []).length}</div>
        \`;
        return;
      }

      if (room.phase === 'assignment') {
        const remainingMs = Math.max(0, (room.assignmentEndsAt || 0) - Date.now());
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        $('game-block').innerHTML = \`
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <h3 style="margin:0;">금지어 설정 단계</h3>
            <span class="timer-pill">⏳ \${minutes}:\${String(seconds).padStart(2, '0')}</span>
          </div>
          <div class="action-note">내가 금지어를 넣어 줄 대상은 <strong>\${escapeHtml(me?.targetNickname || '')}</strong> 님입니다.</div>
          \${me?.submittedWord
            ? \`<div class="submitted-chip">제출 완료: \${escapeHtml(me.submittedWord)}</div>\`
            : \`
              <label class="label" style="margin-top:14px;">금지어 입력</label>
              <div style="display:grid;gap:10px;">
                <input id="assignment-word" placeholder="타겟이 절대 말하면 안 되는 단어를 입력하세요" />
                <button onclick="submitWord()">금지어 제출</button>
              </div>
            \`}
        \`;
        return;
      }

      const boardRows = (data.players || [])
        .filter((player) => player.id !== state.playerId)
        .map((player) => \`
          <div class="status-row \${player.isAlive ? '' : 'out'}">
            <div class="status-meta">
              <strong>\${escapeHtml(player.nickname)}</strong>
              <span class="status-rank">\${player.isAlive ? '생존' : 'OUT' + (player.eliminatedOrder ? ' #' + player.eliminatedOrder : '')}</span>
            </div>
            <div class="status-word">\${escapeHtml(player.forbiddenWord || '비공개')}</div>
          </div>
        \`).join('');

      $('game-block').innerHTML = \`
        <h3>금지어 현황판</h3>
        <div class="action-note">내 금지어는 공개되지 않습니다. 다른 플레이어의 금지어와 생존 상태를 확인하세요.</div>
        \${me?.isAlive
          ? '<div class="timer-pill">내 금지어는 비공개 상태입니다</div>'
          : '<div class="timer-pill" style="background:rgba(239,68,68,0.16);border-color:rgba(248,113,113,0.3);">관전 중입니다</div>'}
        <div class="status-board" style="margin-top:14px;">\${boardRows || '<div class="small">표시할 플레이어가 없습니다.</div>'}</div>
        \${room.phase === 'result' && room.result
          ? \`<div class="result-card" style="margin-top:16px;"><h3>🏆 게임 종료</h3><div>\${escapeHtml(room.result.caption)}</div></div>\`
          : ''}
      \`;
    }

    function renderPlayers(players) {
      $('player-list').innerHTML = (players || []).map((player) => \`
        <div class="player \${player.isAlive ? '' : 'out'}">
          <strong>\${escapeHtml(player.nickname)} \${player.id === state.playerId ? '(나)' : ''}</strong>
          <div class="small">\${player.isAlive ? '생존 중' : '탈락'} \${player.eliminatedOrder ? '· ' + player.eliminatedOrder + '번째 탈락' : ''}</div>
        </div>
      \`).join('');
    }

    function renderLeaderboard(players, room) {
      const items = (players || [])
        .filter((player) => !player.isAlive)
        .sort((a, b) => (a.eliminatedOrder || 999) - (b.eliminatedOrder || 999))
        .map((player) => \`
          <div class="leader-item">\${player.eliminatedOrder}번째 탈락 · \${escapeHtml(player.nickname)}</div>
        \`);

      if (room.phase === 'result' && room.result?.winnerNickname) {
        items.unshift(\`<div class="leader-item" style="border-color:rgba(34,197,94,0.4);color:#dcfce7;">우승 · \${escapeHtml(room.result.winnerNickname)}</div>\`);
      }

      $('leaderboard').innerHTML = items.length
        ? items.join('')
        : '<div class="small">아직 탈락자가 없습니다.</div>';
    }

    function renderChat(messages, canChat) {
      $('chat-messages').innerHTML = (messages || []).map((message) => \`
        <div class="chat-line \${message.type === 'system' ? 'system' : ''}">
          <strong>\${escapeHtml(message.nickname)}</strong> \${escapeHtml(message.text)}
        </div>
      \`).join('');
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
      $('chat-input').disabled = !canChat;
      $('send-btn').disabled = !canChat;
      $('chat-input').placeholder = canChat
        ? '메시지를 입력하고 Enter를 누르세요'
        : '탈락한 플레이어는 관전만 가능합니다';
    }

    function renderState(data) {
      if (data.room.phase !== state.lastPhase) {
        if (data.room.phase === 'playing') {
          setMobileTab('chat');
        } else {
          setMobileTab('game');
        }
        state.lastPhase = data.room.phase;
      }
      state.room = data.room;
      $('room-title').textContent = data.room.name;
      $('room-phase').textContent = data.room.phase;
      $('status-text').textContent = data.room.statusText || '';
      renderGameBlock(data);
      renderPlayers(data.players || []);
      renderLeaderboard(data.players || [], data.room);
      renderChat(data.chatMessages || [], data.room.phase === 'playing' && !!data.myState?.isAlive);
    }

    async function pollState() {
      if (!state.roomId || !state.playerId) return;
      try {
        const data = await api('/api/forbidden-word/rooms/' + state.roomId + '/state?playerId=' + encodeURIComponent(state.playerId) + '&v=' + state.version);
        if (!data.changed) return;
        state.version = data.version;
        renderState(data);
      } catch (_) {
        resetSession(true);
      }
    }

    function startPolling() {
      if (state.poll) clearInterval(state.poll);
      pollState();
      state.poll = setInterval(pollState, 1000);
    }

    $('create-room-btn').onclick = createRoom;
    $('refresh-btn').onclick = loadRooms;
    $('leave-btn').onclick = leaveRoom;
    $('ready-btn').onclick = toggleReady;
    $('start-btn').onclick = startGame;
    $('chat-form').addEventListener('submit', (event) => {
      event.preventDefault();
      sendChat();
    });
    $('chat-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        sendChat();
      }
    });
    $('tab-game-btn').onclick = () => setMobileTab('game');
    $('tab-chat-btn').onclick = () => setMobileTab('chat');
    $('tab-status-btn').onclick = () => setMobileTab('status');

    if (state.roomId && state.playerId) {
      showGame();
      startPolling();
    } else {
      loadRooms();
    }
  </script>
</body>
</html>`;
}
