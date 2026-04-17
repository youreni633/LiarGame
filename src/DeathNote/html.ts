export function getDeathNoteHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>데스노트 게임</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Noto Sans KR', sans-serif; background: radial-gradient(circle at top, #1e293b, #020617 70%); color: #e2e8f0; }
    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }
    .lobby { align-items: center; justify-content: center; padding: 24px; }
    .wrap { width: 100%; max-width: 1100px; display: grid; gap: 20px; grid-template-columns: 360px 1fr; }
    .card { background: rgba(15,23,42,0.9); border: 1px solid rgba(148,163,184,0.18); border-radius: 24px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
    .brand h1 { margin: 0; font-size: 38px; }
    .brand p { color: #94a3b8; line-height: 1.6; }
    .label { display: block; margin-bottom: 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid rgba(148,163,184,0.24); border-radius: 14px; padding: 12px 14px; }
    textarea { min-height: 110px; }
    .stack { display: grid; gap: 14px; }
    .row { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
    button { border: none; border-radius: 14px; padding: 12px 16px; cursor: pointer; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 700; }
    button.secondary { background: #1e293b; }
    button.danger { background: linear-gradient(135deg, #dc2626, #7f1d1d); }
    .room-list { display: grid; gap: 12px; max-height: 600px; overflow: auto; }
    .room-item { border: 1px solid rgba(148,163,184,0.18); border-radius: 18px; padding: 16px; background: rgba(15,23,42,0.7); cursor: pointer; }
    .room-item h3 { margin: 0 0 8px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #cbd5e1; }
    .badge { padding: 4px 10px; border-radius: 999px; background: rgba(59,130,246,0.15); }
    .small { font-size: 12px; color: #94a3b8; }
    .game { display: none; height: 100vh; flex-direction: column; }
    .game.active { display: flex; }
    .topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(2,6,23,0.9); border-bottom: 1px solid rgba(148,163,184,0.14); }
    .topbar h2 { margin: 0; }
    .game-body { flex: 1; display: grid; grid-template-columns: 280px 1fr 360px; min-height: 0; }
    .panel { overflow: auto; padding: 18px; border-right: 1px solid rgba(148,163,184,0.12); }
    .panel:last-child { border-right: none; border-left: 1px solid rgba(148,163,184,0.12); }
    .players { display: grid; gap: 10px; }
    .player { padding: 12px; border-radius: 14px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.14); }
    .player.dead { opacity: 0.55; }
    .hero { background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(124,58,237,0.18)); border: 1px solid rgba(148,163,184,0.15); border-radius: 24px; padding: 24px; margin-bottom: 18px; }
    .hero img, .result img { width: 100%; border-radius: 18px; display: block; margin-bottom: 16px; background: #0f172a; }
    .messages { display: grid; gap: 10px; max-height: 48vh; overflow: auto; margin-bottom: 16px; }
    .msg { padding: 12px 14px; border-radius: 14px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.1); white-space: pre-wrap; line-height: 1.5; }
    .msg.system { color: #cbd5e1; background: rgba(30,41,59,0.95); }
    .command-chip { display: inline-block; padding: 8px 10px; border-radius: 999px; background: rgba(15,23,42,0.9); border: 1px solid rgba(148,163,184,0.18); font-size: 12px; margin-right: 8px; margin-bottom: 8px; cursor: pointer; }
    .status { color: #94a3b8; font-size: 14px; margin-top: 6px; line-height: 1.6; white-space: pre-wrap; }
    .result { background: rgba(15,23,42,0.85); border-radius: 24px; padding: 20px; }
    @media (max-width: 980px) { .wrap, .game-body { grid-template-columns: 1fr; } .panel { border-right: none; border-bottom: 1px solid rgba(148,163,184,0.12); } .panel:last-child { border-left: none; } }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <div class="card">
        <div class="brand">
          <div class="small"><a href="/" style="color:inherit;text-decoration:none;">라이어게임으로 돌아가기</a></div>
          <h1>데스노트 게임</h1>
          <p>완전히 분리된 데스노트 전용 방입니다. 방 생성, 참가, 역할 배정, 명령어 기반 스킬 사용까지 이 페이지에서 진행됩니다.</p>
        </div>
        <div class="stack">
          <div><label class="label">닉네임</label><input id="nickname" placeholder="닉네임을 입력하세요" /></div>
          <div><label class="label">방 이름</label><input id="room-name" placeholder="방 이름(선택)" /></div>
          <div class="row">
            <div><label class="label">게임 모드</label><select id="mode"><option>일반</option><option>사신</option><option>바보</option></select></div>
            <div><label class="label">표시 모드</label><select id="player-mode"><option>이미지</option><option>텍스트</option></select></div>
          </div>
          <button id="create-room-btn">새 데스노트 방 만들기</button>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="margin:0;">참가 가능한 방</h3>
          <button id="refresh-btn" class="secondary">새로고침</button>
        </div>
        <div id="room-list" class="room-list"></div>
      </div>
    </div>
  </div>

  <div id="game-screen" class="game">
    <div class="topbar">
      <div><div class="small" id="room-mode-badge"></div><h2 id="room-title">데스노트 방</h2></div>
      <div style="display:flex;gap:10px;">
        <button id="change-mode-btn" class="secondary">모드 변경</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>
    <div class="game-body">
      <div class="panel">
        <h3 style="margin-top:0;">플레이어</h3>
        <div id="player-list" class="players"></div>
      </div>
      <div class="panel">
        <div class="hero">
          <img id="role-image" alt="role" />
          <h3 id="hero-title" style="margin:0 0 8px;">역할 정보</h3>
          <div id="hero-desc" class="status">게임이 시작되면 역할이 표시됩니다.</div>
        </div>
        <div id="result-box" style="display:none;" class="result"></div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0;">상태 / 로그</h3>
        <div id="status-text" class="status"></div>
        <div id="commands" style="margin:16px 0;"></div>
        <div id="messages" class="messages"></div>
        <div class="stack">
          <textarea id="message-input" placeholder="대화 또는 명령어를 입력하세요. 예: /데스노트 엘 홍길동 심장마비"></textarea>
          <button id="send-btn">전송</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    const state = { nickname: localStorage.getItem('dn:nickname') || '', playerMode: localStorage.getItem('dn:playerMode') || '이미지', playerId: localStorage.getItem('dn:playerId') || '', roomId: localStorage.getItem('dn:roomId') || '', version: 0, poll: null, room: null };
    const $ = (id) => document.getElementById(id);
    $('nickname').value = state.nickname; $('player-mode').value = state.playerMode;
    const escapeHtml = (v) => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const showLobby = () => { $('lobby-screen').classList.add('active'); $('game-screen').classList.remove('active'); };
    const showGame = () => { $('lobby-screen').classList.remove('active'); $('game-screen').classList.add('active'); };
    function saveIdentity(){ localStorage.setItem('dn:nickname',$('nickname').value.trim()); localStorage.setItem('dn:playerMode',$('player-mode').value); localStorage.setItem('dn:playerId',state.playerId||''); localStorage.setItem('dn:roomId',state.roomId||''); }
    async function api(url, options={}){ const res = await fetch(url,{ headers:{'Content-Type':'application/json'}, ...options }); const data = await res.json(); if(!res.ok) throw new Error(data.error||'요청 실패'); return data; }
    async function loadRooms(){ const data = await api('/api/deathnote/rooms'); const rooms = data.rooms || []; $('room-list').innerHTML = rooms.length ? rooms.map((room)=>\`<div class="room-item" onclick="joinRoom('\${room.id}')"><h3>\${escapeHtml(room.name)}</h3><div class="meta"><span class="badge">\${room.mode}</span><span class="badge">\${room.phase}</span><span class="badge">\${room.players}/\${room.maxPlayers}</span></div></div>\`).join('') : '<div class="small">현재 참가 가능한 데스노트 방이 없습니다.</div>'; }
    async function createRoom(){ state.nickname = $('nickname').value.trim(); state.playerMode = $('player-mode').value; if(!state.nickname){ alert('닉네임을 입력해주세요.'); return; } const data = await api('/api/deathnote/rooms',{ method:'POST', body: JSON.stringify({ nickname: state.nickname, roomName: $('room-name').value.trim(), mode: $('mode').value, playerMode: state.playerMode }) }); state.playerId = data.playerId; state.roomId = data.roomId; state.version = 0; saveIdentity(); showGame(); startPolling(); }
    async function joinRoom(roomId){ state.nickname = $('nickname').value.trim(); state.playerMode = $('player-mode').value; if(!state.nickname){ alert('닉네임을 입력해주세요.'); return; } const data = await api('/api/deathnote/rooms/' + roomId + '/join',{ method:'POST', body: JSON.stringify({ nickname: state.nickname, playerMode: state.playerMode }) }); state.playerId = data.playerId; state.roomId = data.roomId; state.version = 0; saveIdentity(); showGame(); startPolling(); }
    async function leaveRoom(){ if(!state.roomId || !state.playerId) return; try{ await api('/api/deathnote/rooms/' + state.roomId + '/leave',{ method:'POST', body: JSON.stringify({ playerId: state.playerId }) }); }catch(_){ } state.roomId=''; state.playerId=''; state.version=0; saveIdentity(); if(state.poll) clearInterval(state.poll); showLobby(); loadRooms(); }
    async function startGame(){ await api('/api/deathnote/rooms/' + state.roomId + '/start',{ method:'POST', body: JSON.stringify({ playerId: state.playerId }) }); }
    async function changeMode(){ const nextMode = prompt('변경할 모드를 입력하세요: 일반 / 사신 / 바보', state.room?.mode || '일반'); if(!nextMode) return; await api('/api/deathnote/rooms/' + state.roomId + '/mode',{ method:'POST', body: JSON.stringify({ playerId: state.playerId, mode: nextMode }) }); }
    async function sendMessage(){ const input = $('message-input'); const message = input.value.trim(); if(!message) return; await api('/api/deathnote/rooms/' + state.roomId + '/chat',{ method:'POST', body: JSON.stringify({ playerId: state.playerId, message }) }); input.value=''; }
    function renderState(data){ state.room = data.room; $('room-title').textContent = data.room.name; $('room-mode-badge').textContent = data.room.mode + ' 모드'; $('status-text').textContent = data.room.statusText || ''; const isHost = data.room.hostId === state.playerId; $('start-btn').style.display = isHost && data.room.phase === 'lobby' ? 'inline-flex' : 'none'; $('change-mode-btn').style.display = isHost && data.room.phase === 'lobby' ? 'inline-flex' : 'none'; $('player-list').innerHTML = (data.players||[]).map((player)=>\`<div class="player \${player.alive?'':'dead'}"><strong>\${escapeHtml(player.name)} \${player.id === state.playerId ? '(나)' : ''}</strong><div class="small">상태: \${escapeHtml(player.alive ? '생존' : player.deathreason)}</div>\${player.revealedRole ? '<div class="small">역할: ' + escapeHtml(player.revealedRole) + '</div>' : ''}</div>\`).join(''); const myRole = data.myRole; if(myRole){ $('role-image').style.display = myRole.hidden || myRole.mode === '텍스트' ? 'none' : 'block'; $('role-image').src = myRole.img; $('hero-title').textContent = myRole.hidden ? '바보 모드' : myRole.role + ' / ' + myRole.team; $('hero-desc').textContent = myRole.hidden ? '바보모드에서는 당신의 역할을 알려주지 않습니다.' : myRole.explain + '\\n\\n상태: ' + myRole.deathreason + '\\n귓속말: ' + myRole.whisper + '회 / 쪽지: ' + myRole.note + '회'; } $('commands').innerHTML = (data.availableCommands||[]).map((command)=>\`<span class="command-chip" onclick="fillCommand('\${command.replace(/'/g, "\\\\'")}')">\${escapeHtml(command)}</span>\`).join(''); $('messages').innerHTML = (data.messages||[]).slice(-80).map((message)=>\`<div class="msg \${message.type === 'system' ? 'system' : ''}">\${escapeHtml(message.text)}</div>\`).join(''); $('messages').scrollTop = $('messages').scrollHeight; const resultBox = $('result-box'); if(data.result){ const image = data.result.imageByPlayerId[state.playerId]; resultBox.style.display='block'; resultBox.innerHTML = \`<img src="\${image}" alt="result" /><h3>\${escapeHtml(data.result.title)}</h3><div class="status">\${escapeHtml(data.result.caption)}</div><div class="status">\${data.result.entries.map((entry)=> escapeHtml(entry.role + ': ' + entry.name + ' - 결과: ' + entry.result)).join('<br/>')}</div>\`; } else { resultBox.style.display='none'; } }
    async function pollState(){ if(!state.roomId || !state.playerId) return; const data = await api('/api/deathnote/rooms/' + state.roomId + '/state?playerId=' + encodeURIComponent(state.playerId) + '&v=' + state.version); if(!data.changed) return; state.version = data.version; renderState(data); }
    function startPolling(){ if(state.poll) clearInterval(state.poll); pollState(); state.poll = setInterval(pollState, 2000); }
    function fillCommand(command){ $('message-input').value = command + ' '; $('message-input').focus(); }
    $('create-room-btn').onclick = createRoom; $('refresh-btn').onclick = loadRooms; $('leave-btn').onclick = leaveRoom; $('start-btn').onclick = startGame; $('change-mode-btn').onclick = changeMode; $('send-btn').onclick = sendMessage; $('message-input').addEventListener('keydown',(event)=>{ if((event.ctrlKey || event.metaKey) && event.key === 'Enter'){ sendMessage(); } });
    if(state.roomId && state.playerId){ showGame(); startPolling(); } else { loadRooms(); }
    window.joinRoom = joinRoom; window.fillCommand = fillCommand;
  </script>
</body>
</html>`;
}
