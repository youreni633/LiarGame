import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";

type User = { id: string; nickname: string };
type Room = { code: string; players: Array<{ id: string; nickname: string; isHost: boolean }>; state: PublicState | null };
type PublicCell = { height: number; topColor: "BLACK" | "WHITE" | null };
type PublicState = { revision: number; matchStatus: string; roundNumber: number; roundStatus: string; board: PublicCell[][]; currentTurnColor: "BLACK" | "WHITE"; remainingStonesByColor: Record<"BLACK" | "WHITE", number>; playerIdsByColor: Record<"BLACK" | "WHITE", string>; roundScoreByPlayer: Record<string, number>; roundWinner: string | null; resultReason: string | null; turnDeadline: number | null; openingIndex: number; openingSequence: Array<"BLACK" | "WHITE">; nextRoundColorSelectorId: string | null; nextRoundBlackPlayerId: string | null; };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "요청에 실패했습니다.");
  return body as T;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [nickname, setNickname] = useState("게스트");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ row: number; column: number } | null>(null);

  useEffect(() => { request<{ user: User | null }>("/api/session").then((value) => { setUser(value.user); if (value.user) setNickname(value.user.nickname); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!room) return;
    const socket = io({ path: "/threemok/socket.io", withCredentials: true });
    socket.emit("room:watch", room.code);
    socket.on("room:state", (next: Room) => setRoom(next));
    return () => { socket.disconnect(); };
  }, [room?.code]);

  async function login() { try { setError(""); const value = await request<{ user: User }>("/api/auth/dev", { method: "POST", body: JSON.stringify({ nickname }) }); setUser(value.user); } catch (e) { setError((e as Error).message); } }
  async function createRoom() { if (!user) return; try { setError(""); setRoom(await request<Room>("/api/rooms", { method: "POST", body: JSON.stringify({ nickname }) })); } catch (e) { setError((e as Error).message); } }
  async function joinRoom() { if (!user) return; try { setError(""); setRoom(await request<Room>(`/api/rooms/${roomCode}/join`, { method: "POST", body: JSON.stringify({ nickname, roomCode }) })); } catch (e) { setError((e as Error).message); } }
  async function command(payload: Record<string, unknown>) {
    if (!room?.state || !user) return;
    try { setError(""); const next = await request<{ state: PublicState }>(`/api/rooms/${room.code}/commands`, { method: "POST", body: JSON.stringify({ ...payload, commandId: crypto.randomUUID(), expectedRevision: room.state.revision, now: Date.now(), playerId: user.id }) }); setRoom({ ...room, state: next.state }); } catch (e) { setError((e as Error).message); }
  }
  const myColor = useMemo(() => room?.state && user ? (room.state.playerIdsByColor.BLACK === user.id ? "BLACK" : room.state.playerIdsByColor.WHITE === user.id ? "WHITE" : null) : null, [room, user]);
  const selectedCell = selected && room?.state?.board[selected.row]?.[selected.column];

  if (!user) return <main className="shell"><section className="hero"><p className="eyebrow">NEW PLATFORM · /THREEMOK</p><h1>삼단오목</h1><p>기존 게임과 분리된 실시간 보드게임 플랫폼입니다.</p></section><section className="card login"><h2>플레이어 입장</h2><input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="닉네임" /><button onClick={login}>개발 세션으로 시작</button><a className="oauth-button" href="/api/auth/google/start">Google로 로그인</a><small>Google OAuth가 설정되지 않은 환경에서는 개발 세션을 사용할 수 있습니다.</small>{error && <p className="error">{error}</p>}</section></main>;
  if (!room) return <main className="shell"><section className="hero"><p className="eyebrow">THREE-LEVEL OMOK</p><h1>쌓고, 읽고, 뒤집는 오목</h1><p>10×10 보드 위에 최대 3단까지 돌을 쌓아 플레이하세요.</p></section><section className="card lobby"><div className="user-pill">{user.nickname}</div><div className="actions"><button onClick={createRoom}>방 만들기</button><div className="join"><input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="방 코드" /><button className="secondary" onClick={joinRoom}>참가</button></div></div>{error && <p className="error">{error}</p>}</section></main>;

  return <main className="shell game-shell"><header><div><p className="eyebrow">ROOM {room.code}</p><h1>삼단오목</h1></div><div className="user-pill">{user.nickname} · {myColor ?? "관전자"}</div></header><section className="game-layout"><div className="card board-card"><div className="board" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>{room.state?.board.map((row, r) => row.map((cell, c) => <button key={`${r}-${c}`} className={`cell ${cell.topColor?.toLowerCase() ?? "empty"}`} onClick={() => { setSelected({ row: r, column: c }); if (room.state?.roundStatus === "PLAYING") void command({ type: "PLACE", position: { row: r, column: c } }); }}><span>{cell.height > 0 ? cell.height : ""}</span></button>))}</div><div className="board-caption"><span>Revision {room.state?.revision}</span><span>{room.state?.roundStatus}</span><span>현재 턴: {room.state?.currentTurnColor}</span></div></div><aside className="card panel"><h2>게임 로비</h2>{room.players.map((player) => <div className="player" key={player.id}><span className={`dot ${room.state?.playerIdsByColor.BLACK === player.id ? "black" : "white"}`} />{player.nickname}{player.isHost && <small> HOST</small>}</div>)}<hr /><p>라운드 {room.state?.roundNumber} · 점수</p>{room.players.map((player) => <div className="score" key={player.id}><span>{player.nickname}</span><strong>{room.state?.roundScoreByPlayer[player.id] ?? 0}</strong></div>)}<button onClick={() => void command({ type: "READY", ready: true })}>Ready</button>{room.state?.roundStatus === "WAITING_READY" && room.players.length === 2 && <button className="secondary" onClick={() => void command({ type: "START_ROUND", blackPlayerId: room.players[0].id, whitePlayerId: room.players[1].id })}>라운드 시작</button>}{selectedCell && <p className="hint">선택 칸: {selectedCell.height}단</p>}{error && <p className="error">{error}</p>}</aside></section></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
