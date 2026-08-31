# Judgement Online

`Judgement` is now scaffolded as a browser-based multiplayer card game with a Node.js + Socket.io backend and a React client.

## Overview

This first implementation milestone includes:

- a monorepo workspace with `server/` and `client/`
- Socket.io room creation, room joining, and reconnect-friendly player IDs
- an initial room state engine that starts round one and deals cards
- a React/Vite UI for creating or joining rooms and viewing synced game state

## Tech Stack

- `server/`: Node.js, Express, Socket.io
- `client/`: React, Vite, Socket.io Client
- planning docs: `implementation_plan.md` and `judgement_online_design.md`

## Project Structure

```text
Judgement/
|-- client/
|   `-- src/
|       |-- components/
|       |-- context/
|       `-- hooks/
|-- server/
|   `-- src/
|       |-- game/
|       `-- socket/
|-- implementation_plan.md
|-- judgement_online_design.md
`-- README.md
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the backend:
   ```bash
   npm run dev:server
   ```
3. Start the frontend in a second terminal:
   ```bash
   npm run dev:client
   ```

The backend listens on `http://localhost:3001` and the client dev server on `http://localhost:5173`.
The client connects to the backend via `VITE_SOCKET_URL` (defaults to `http://localhost:3001` in dev); see `client/.env.example`.

## Current Scope

Implemented:

- room lifecycle scaffolding
- initial finite state structure
- first-round dealing and trump assignment
- responsive lobby and room UI

Next up:

- bidding flow and forbidden-bid validation
- trick play rules and scoring
- turn timers, auto-play fallback, and reconnection recovery polish
