# LiarGame Azure Server

## Overview
- Project: browser-based liar game server for Azure Web App
- Stack: Hono + TypeScript + Node.js
- Runtime: single Node server that serves both game API and SPA UI
- Current deploy version: `v1.04`

## Run
```bash
npm install
npm run build
npm start
```

Development mode:
```bash
npm run dev
```

## Build And Output
- Source entry: `src/index.ts`
- Build output: `dist/index.js`
- TypeScript config: `tsconfig.json`

## Game Flow
1. Create or join a room
2. Wait until all players are ready
3. Start game and reveal each player's word
4. First speaking round
5. Free chat
6. Optional extend vote and second speaking round
7. Final liar vote
8. Liar guess or result reveal

## Game Modes
### Classic Liar
- The liar is explicitly told they are the liar
- The liar sees the word as `???`

### Fool Liar
- The liar is not told they are the liar during word reveal
- The liar receives a similar word instead of the real word
- The liar usually discovers the truth only later in the round result flow

## Recent Changes In v1.04
### Game Mode
- Added room-level game mode selection
- Added `classic` and `fool` modes
- Host can change game mode while the room is still in `waiting`

### Room Control
- Host can kick players before the game starts
- Kick action is limited to the `waiting` phase

### Chat UI
- Reduced duplicated speaking summary exposure
- On mobile chat tab, speaking summary is hidden so chat stays primary
- Increased bottom spacing in mobile chat area to reduce overlap with input/tab area
- On mobile, the UI automatically switches back to the game tab when vote phases begin

### Round Timeout
- Speaking turns now auto-skip when the current speaker does not submit within the speaking time limit
- Extend-vote and final-vote phases now auto-close after 60 seconds
- Non-voters are treated as abstained, and current submitted votes are used to resolve the phase
- Tie or empty final votes are resolved as liar survival

### Word Reveal Stability
- Added defensive handling so the word area is less likely to appear blank on some phones
- Added minimum height and safer wrapping rules for the revealed word area
- Kept fool mode role-hiding behavior while stabilizing displayed text

## Health Check
Health endpoint:
```http
GET /health
```

Example response:
```json
{
  "ok": true,
  "version": "v1.04",
  "timestamp": 1713340000000
}
```

This is intended for Azure warm-up, availability checks, and verifying deployed version.

## Main API
| Method | Path | Description |
|---|---|---|
| GET | `/` | Serve main SPA |
| GET | `/health` | Health check with deploy version |
| GET | `/api/rooms` | List rooms |
| POST | `/api/rooms` | Create room |
| POST | `/api/rooms/:id/join` | Join room |
| POST | `/api/rooms/:id/leave` | Leave room |
| POST | `/api/rooms/:id/ready` | Toggle ready |
| POST | `/api/rooms/:id/start` | Start game |
| POST | `/api/rooms/:id/confirm-word` | Confirm revealed word |
| POST | `/api/rooms/:id/speak` | Submit speaking turn |
| POST | `/api/rooms/:id/chat` | Send chat |
| POST | `/api/rooms/:id/end-free-chat` | End free chat |
| POST | `/api/rooms/:id/vote-extend` | Vote for extra round |
| POST | `/api/rooms/:id/vote` | Final liar vote |
| POST | `/api/rooms/:id/liar-guess` | Liar final guess |
| POST | `/api/rooms/:id/new-game` | Reset to waiting state |
| POST | `/api/rooms/:id/category` | Change category |
| POST | `/api/rooms/:id/game-mode` | Change game mode |
| POST | `/api/rooms/:id/kick` | Kick a player before game start |
| GET | `/api/rooms/:id/state` | Poll room state |

## Azure Notes
- The server listens on `process.env.PORT`
- Game state is stored in memory, so scale-out or restarts reset active rooms
- For stable behavior, deploy as a single instance unless state storage is externalized
