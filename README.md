# Judgement Online

Judgement Online is a browser-based multiplayer card game built around a server-authoritative game engine. Players use a React web client to join a room, take seats, bid, play cards, and follow the live score. The Node.js server owns the room state, validates every action, advances the game phases, and broadcasts sanitized snapshots through Socket.io.

This document explains the project as it exists in code. It covers setup, architecture, the complete game workflow, rules, state transitions, networking, client rendering, host controls, timers, reconnection, deployment, and current limitations.

## Table of Contents

- [Product Model](#product-model)
- [Current Capabilities](#current-capabilities)
- [Technology Stack](#technology-stack)
- [Repository Layout](#repository-layout)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Game Workflow](#game-workflow)
- [Game State Machine](#game-state-machine)
- [Rules and Scoring](#rules-and-scoring)
- [Server Logic](#server-logic)
- [Client Logic](#client-logic)
- [Socket Protocol](#socket-protocol)
- [Host Controls](#host-controls)
- [Timers and Automatic Actions](#timers-and-automatic-actions)
- [Reconnection and Session Recovery](#reconnection-and-session-recovery)
- [Data Privacy and State Sanitization](#data-privacy-and-state-sanitization)
- [Production Deployment](#production-deployment)
- [Development Commands](#development-commands)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Related Documentation](#related-documentation)

## Product Model

The game uses rooms rather than accounts. A player chooses a nickname, creates or joins a room, and receives a persistent player ID stored in browser `localStorage`. The room creator becomes the host. Players may sit at the table or join as unseated viewers.

The server keeps one authoritative room object for each active room. The browser never decides whether an action is legal. It requests an action through Socket.io, the server validates and applies it, and every connected player receives a new sanitized state snapshot.

The current runtime is intentionally small and in-memory:

- There is no database.
- There is no account system or authentication layer.
- A server restart destroys active rooms and game progress.
- Socket.io is used for commands and state updates.
- The built React application can be served by the same Express process as the Socket.io server.

## Current Capabilities

- Create a room with a generated room code.
- Join an existing room by code.
- Reconnect using the same browser player ID.
- Select and leave table seats in the lobby.
- Keep unseated players as viewers.
- Reorder seated players before a game starts.
- Remove players from a room when host permissions allow it.
- Configure the first round's card count and trump suit.
- Deal cards from a standard 52-card deck.
- Run the pre-bidding phase and skip it with a host action.
- Submit and validate sequential bids.
- Enforce the forbidden final bid rule.
- Enforce the led-suit rule during trick play.
- Resolve trump and led-suit winners.
- Calculate round scores.
- Show trick-complete and round-summary phases.
- Automatically progress through the round sequence.
- Pause and resume active gameplay as host.
- Automatically submit safe actions when a turn expires.
- End a match from the round summary.
- Reset the room for a rematch after game over.
- Show connection status, timers, cards, seats, scores, and round state in the client.
- Serve a JSON health endpoint at `/health`.

## Technology Stack

### Server

- Node.js 18 or newer
- ECMAScript modules
- Express for HTTP serving and health checks
- Socket.io for real-time commands and state snapshots
- In-memory `Map`-based room management

### Client

- React 18
- Vite
- Framer Motion for interface motion
- Socket.io Client
- CSS-based responsive table and lobby UI
- SVG and WebP card assets

### Build and deployment

- npm workspaces for the root, client, and server packages
- Vite production build for the client
- Multi-stage Node 20 Alpine Docker image

## Repository Layout

```text
Judgement/
|-- client/
|   |-- public/
|   |-- src/
|       |-- assets/cards/          Card face and back assets
|       |-- components/            Lobby, table, card, timer, and control UI
|       |-- context/               Shared Socket.io context
|       |-- hooks/                 Game state, sounds, and deal sequencing
|       |-- lib/                   Card, seat, trick, sound, and timer helpers
|       |-- App.jsx                 Top-level lobby/game switch
|       |-- main.jsx                React entry point
|       `-- styles.css              Application styling
|   |-- .env.example               Client environment template
|   |-- index.html                 Vite HTML entry point
|   `-- package.json
|-- server/
|   |-- src/
|       |-- game/
|       |   |-- roomManager.js     Room membership and host authorization
|       |   |-- rules.js            Deck, suits, ranks, and rule helpers
|       |   `-- stateEngine.js      State machine and game mutations
|       |-- socket/
|       |   `-- handlers.js         Socket event registration and broadcasts
|       `-- index.js                Express, Socket.io, static files, and startup
|   `-- package.json
|-- Dockerfile                      Production image definition
|-- package.json                    Workspace scripts
|-- package-lock.json               Locked dependency tree
|-- implementation_plan.md          Planning and architecture notes
|-- implementation_status.md        Progress and verification notes
|-- judgement_online_design.md      Original design specification
|-- SETUP.md                        Short setup guide
`-- README.md
```

## Quick Start

### Requirements

- Node.js 18 or newer
- npm, included with Node.js
- A modern browser with WebSocket support

### Install

Run this from the repository root:

```bash
npm install
```

The root package is an npm workspace. This installs dependencies for both `client/` and `server/` using the root lockfile.

### Run the development server

Open two terminals in the repository root.

Terminal 1:

```bash
npm run dev:server
```

This starts Node with file watching. The Socket.io and HTTP server listens on port `3001`.

Terminal 2:

```bash
npm run dev:client
```

This starts Vite. Open:

```text
http://localhost:5173
```

The development client connects to:

```text
http://127.0.0.1:3001
```

If the client and server run on different hosts or ports, configure `VITE_SOCKET_URL` as described below.

## Configuration

### Client configuration

The client reads `VITE_SOCKET_URL` through Vite. Start from the provided example:

```bash
copy client\.env.example client\.env.local
```

On macOS or Linux:

```bash
cp client/.env.example client/.env.local
```

Set the backend URL:

```env
VITE_SOCKET_URL=http://127.0.0.1:3001
```

Behavior when `VITE_SOCKET_URL` is unset:

- Development: the client uses `http://127.0.0.1:3001`.
- Production: the client uses the current page origin, allowing the built client and server to share one host.

### Server configuration

The server supports:

| Variable | Default | Purpose |
|---|---:|---|
| `PORT` | `3001` | HTTP and Socket.io listening port |
| `CORS_ORIGIN` | `*` | Comma-separated browser origin allowlist |

Example:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173,https://example.com
```

`CORS_ORIGIN` is split on commas and trimmed before being passed to both Express CORS and Socket.io CORS configuration.

## Architecture

The runtime is a single Node.js process containing the HTTP server, Socket.io server, room manager, and game state engine. The browser is a React single-page application.

```text
Browser
  |
  | React components and hooks
  v
SocketContext / useGameState
  |
  | Socket.io commands
  v
Socket handlers
  |
  v
RoomManager ---- authorization, membership, seats, host operations
  |
  v
StateEngine ---- phase transitions, dealing, bids, cards, tricks, scores
  |
  v
Sanitized room snapshot
  |
  +----> player 1 socket
  +----> player 2 socket
  `----> player N socket
```

### Request and broadcast lifecycle

Every gameplay command follows this sequence:

1. A UI component calls an action exposed by `useGameState`.
2. The hook emits a named Socket.io event with `roomId`, `playerId`, and the action data.
3. `server/src/socket/handlers.js` receives the event.
4. The handler calls a `RoomManager` method.
5. `RoomManager` checks membership, host permission, phase, turn ownership, and input validity.
6. The state engine mutates the room only if all checks pass.
7. The handler emits a sanitized `room:state_update` to each connected player.
8. Each client replaces its local room snapshot and React renders the new phase.
9. If the action fails, the requesting socket receives `game:error` with an error code.

The server does not broadcast a client-provided state. It calculates the next state itself and sends the result.

### Why snapshots are used

The current client receives complete room snapshots rather than a stream of fine-grained domain events. This keeps the client simple and makes reconnection straightforward: once a socket reconnects, it requests or receives a complete current state instead of replaying every missed action.

The tradeoff is that snapshots are larger than individual event payloads. This is appropriate for the current room size and game complexity, but a future high-scale version could add versioned patches or event replay.

## Game Workflow

### 1. Create or join a room

The user starts in the lobby. The create form sends `room:create` with a nickname and optional saved player ID. The join form sends `room:join` with a room code, nickname, and optional saved player ID.

The server then:

1. Creates a room or locates the requested room.
2. Creates a player record or restores the matching player ID.
3. Associates the player's current Socket.io connection.
4. Joins the socket to the room channel.
5. Sends a personalized room snapshot.
6. Sends `room:created` or `room:joined` to the requesting client.

The player ID is persisted in `localStorage` along with room and nickname information. This is a session convenience, not an authentication credential.

### 2. Prepare the lobby

Players can select a seat or remain unseated. The host can:

- Reorder players before the game begins.
- Remove players while the room is in an allowed phase.
- Choose the initial card count.
- Choose the initial trump suit.
- Start the game once enough players are seated.

The state engine requires at least two seated players to begin.

### 3. Start the first round

When the host sends `game:start`, the server:

1. Confirms that the requester is the room host.
2. Confirms that the room is in `LOBBY`.
3. Validates the seated player count.
4. Establishes the dealer and round configuration.
5. Shuffles and deals the configured number of cards.
6. Assigns the selected or rotating trump suit.
7. Moves the room to `PRE_BIDDING`.
8. Starts the 30-second pre-bidding timer.

The host can send `game:start_bidding` to skip the pre-bidding countdown.

### 4. Bid in order

After the pre-bidding phase, the room moves to `BIDDING`. Bids occur sequentially, beginning with the seat clockwise from the dealer.

For each player:

1. The server identifies the active bidder.
2. The client displays the bidding overlay.
3. The client disables bids that the server considers impossible, including the forbidden final bid.
4. The player submits `game:bid`.
5. The server validates the number, player, phase, and turn.
6. The server records the bid and advances to the next bidder.
7. After the final bid, the room moves to `TRICK_PLAYING`.

Each bid has a 30-second timer. If it expires, the server chooses the lowest legal bid and advances the game without trusting the client clock.

### 5. Play tricks

During `TRICK_PLAYING`, the active player chooses a card from their hand. The server validates:

- The player is active and owns the turn.
- The card exists in the player's hand.
- The card is legal under the led-suit rule.
- The room is not paused.

After the final card is played in a trick:

1. The server calculates the trick winner.
2. The room moves to `TRICK_COMPLETE`.
3. The completed trick remains visible during a five-second reveal timer.
4. The winner receives the trick and the score state is updated.
5. The next player leads the next trick, or the room advances to `ROUND_SUMMARY` if no cards remain.

Each card-play turn has a 20-second timer. If the timer expires, the server selects a legal fallback card.

### 6. Review the round

In `ROUND_SUMMARY`, players see bids, tricks, and scores. The summary phase has a five-second timer. The next round normally begins automatically.

The host can use the round controls to:

- Select a custom card count.
- Select a custom trump suit.
- Advance to the next round manually.
- End the match.

The standard round sequence ascends from one card to the maximum hand size and then descends back to one card. The maximum is `floor(52 / seatedPlayers)`.

### 7. Finish or rematch

When the descending sequence is complete, the room enters `GAME_OVER`. The host can send `game:rematch` to reset the game to the lobby while retaining the room and player membership.

The host can also end a match from the round summary by sending `game:next_round` with `action: "end_game"`.

## Game State Machine

The runtime state names are defined in `server/src/game/stateEngine.js`.

```text
                    game:start
                         |
                         v
LOBBY -------------> PRE_BIDDING
  ^                      |
  |              timer or start_bidding
  |                      v
  |                   BIDDING
  |                      |
  |                final legal bid
  |                      v
  |                TRICK_PLAYING
  |                      |
  |                 all cards played
  |                      v
  |                TRICK_COMPLETE
  |                 |            |
  |           more cards      no cards
  |                 |            |
  |                 +---> TRICK_PLAYING
  |                              |
  |                              v
  |                        ROUND_SUMMARY
  |                         |          |
  |                  next round     end game
  |                         |          |
  |                         v          v
  |                     PRE_BIDDING  GAME_OVER
  |                                      |
  +------------ game:rematch -----------+
```

### Phase responsibilities

| Phase | Server responsibility | Client responsibility |
|---|---|---|
| `LOBBY` | Manage players, seats, ordering, and host configuration | Show create/join controls, room code, seats, and host controls |
| `PRE_BIDDING` | Hold the dealt hands and run the pre-bidding countdown | Show round setup and countdown |
| `BIDDING` | Enforce bidder order and forbidden-bid validation | Show legal bid options and active bidder |
| `TRICK_PLAYING` | Enforce turn ownership, card ownership, and led suit | Highlight playable cards and show the table |
| `TRICK_COMPLETE` | Resolve the winner and schedule reveal completion | Show the completed trick and winner reveal |
| `ROUND_SUMMARY` | Apply round result and prepare the next round | Show score summary and host round actions |
| `GAME_OVER` | Hold final scores and accept rematch | Show final state and rematch controls |

## Rules and Scoring

### Deck

The rules engine uses a standard 52-card deck with ranks from 2 through Ace and four suits:

- Spades
- Diamonds
- Clubs
- Hearts

Cards are dealt only to seated players. The deal begins from the dealer and continues clockwise through the occupied seats.

### Bidding

For a round with `N` cards, each bid must be an integer from `0` through `N`.

The final bidder cannot choose the value that would make the total bids equal to the number of tricks in the round:

```text
forbiddenBid = cardsInRound - sum(previousBids)
```

This prevents the table from collectively predicting exactly every available trick. The rule is enforced on the server even if a client submits a manually crafted Socket.io message.

### Card legality

If a player holds at least one card in the led suit, the player must play that suit. If the player has no card in the led suit, any card may be played.

The client marks legal cards for usability, but the server repeats the check before mutating state.

### Trick winner

Winner priority is:

1. The highest trump card, if any trump cards were played.
2. Otherwise, the highest card of the led suit.
3. Off-suit cards that are not trump cannot win.

The rules engine, not the client, determines the winner.

### Score calculation

The current scoring rules are:

| Result | Score |
|---|---:|
| Positive bid exactly equals tricks won | `bid * 10` |
| Bid is zero and no tricks are won | `10` |
| Any other result | `0` |

The room stores the cumulative score and the round-level bid and trick counts needed for the summary UI.

## Server Logic

### `server/src/index.js`

The server entry point:

1. Creates an Express application.
2. Creates a Node HTTP server around Express.
3. Configures Express and Socket.io CORS.
4. Serves `client/dist` as static content.
5. Exposes `GET /health` with `{ "ok": true }`.
6. Registers all Socket.io handlers.
7. Falls back to `client/dist/index.html` for browser routes.
8. Listens on `0.0.0.0` and `PORT` or port `3001`.

The static fallback is what allows a production build to serve the single-page application and its client-side routes from the same process.

### `server/src/socket/handlers.js`

This file is the transport boundary. It does not contain the game rules. It is responsible for:

- Receiving Socket.io events.
- Calling the correct room manager method.
- Converting exceptions into `game:error` responses.
- Emitting personalized room snapshots.
- Scheduling and clearing room timers.
- Marking socket disconnections through the room manager.

`emitRoomState` loops through the room's players and sends each connected player a snapshot generated with that player's ID. This is important because the server must not send one player's private hand to another player.

Room timeout scheduling uses the expected `endsAt` value. When a timeout callback fires, it checks that the room still has the same timer timestamp before applying the automatic action. This prevents an old timer callback from acting after a player has already responded or a host has paused the room.

### `server/src/game/roomManager.js`

The room manager owns room-level operations and permission checks. It coordinates membership with the state engine.

Responsibilities include:

- Generating room IDs.
- Creating and locating rooms.
- Creating, restoring, and disconnecting players.
- Assigning and releasing seats.
- Tracking the room host.
- Validating host-only operations.
- Delegating game mutations to the state engine.
- Returning sanitized room data.

The room manager is the correct place for authorization because host permissions should not be implemented only in React UI controls.

### `server/src/game/stateEngine.js`

The state engine owns the deterministic game rules and phase transitions. It handles:

- Room initialization.
- Round setup and dealing.
- Dealer rotation.
- Bidding order.
- Forbidden-bid validation.
- Trick play.
- Follow-suit validation.
- Trick winner selection.
- Score calculation.
- Timer state.
- Pause and resume behavior.
- Round and game-over transitions.
- Server-side automatic actions.

The state engine mutates the room only after validating the current phase and action context. It is the main source of truth for game behavior.

### `server/src/game/rules.js`

The rules module contains stable card-level concepts such as suits, rank ordering, deck construction, and rotating trump selection. Keeping these definitions outside the socket handlers prevents transport code from becoming coupled to card comparison logic.

## Client Logic

### Application entry

`client/src/main.jsx` creates the React root, wraps the application in `SocketProvider`, and imports global styles.

`client/src/App.jsx` calls `useGameState` and chooses between:

- The create/join lobby when no active room exists.
- `GameBoard` when a room snapshot is available.

This keeps the top-level routing decision small. The game phases are rendered inside the board rather than through a router.

### Socket connection context

`client/src/context/SocketContext.jsx` creates the Socket.io client and exposes connection state to the application. It centralizes the connection so components do not create competing socket instances.

### `useGameState`

`client/src/hooks/useGameState.js` is the client-side application controller. It:

1. Loads the saved room session from `localStorage`.
2. Creates the Socket.io event listeners.
3. Attempts to rejoin when the socket connects.
4. Stores the latest sanitized room snapshot.
5. Tracks the local player ID.
6. Converts button and card interactions into Socket.io commands.
7. Handles room creation and join acknowledgements.
8. Clears the local session after a kick or invalid session.
9. Requests a room sync when the page becomes visible again.
10. Exposes gameplay actions to components.

The hook does not calculate authoritative scores or winners. It displays server results and provides commands.

### `GameBoard`

`client/src/components/GameBoard.jsx` maps the current server phase to the visible interface. It coordinates:

- Player seats and table layout.
- Room code and connection badge.
- Trump indicator.
- Turn order.
- Active timer.
- Bidding overlay.
- Player hand.
- Trick table.
- Round summary.
- Game-over state.
- Host-only controls.

### Bidding and card components

`BiddingOverlay.jsx` presents bid choices and the forbidden-bid explanation. It uses the current snapshot to disable invalid actions before sending `game:bid`.

`PlayingHand.jsx` and `PlayingCard.jsx` render the local player's hand. They use server-provided phase and turn information to determine whether a card should be interactive. The server still validates every card play.

`TrickTable.jsx`, `TrumpIndicator.jsx`, `TurnOrder.jsx`, and the seat components render derived views of the current snapshot. They do not own separate game state.

### Host controls

`AdminRoundControl.jsx` contains host-only actions for round configuration, early bidding, pause/resume, round advancement, match ending, player ordering, and player removal. The UI hides or disables controls based on phase, but the server remains the final authorization boundary.

## Socket Protocol

All command payloads use the player's current `roomId` and `playerId` unless noted otherwise.

### Client-to-server events

| Event | Payload | Purpose |
|---|---|---|
| `room:create` | `nickname`, optional `playerId` | Create a room and add the creator |
| `room:join` | `roomId`, `nickname`, optional `playerId` | Join or reconnect to a room |
| `room:sync` | `roomId`, `playerId` | Reassociate an existing session after reconnect |
| `seat:take` | `roomId`, `playerId`, `seatIndex` | Take a table seat |
| `seat:leave` | `roomId`, `playerId` | Leave the current seat |
| `room:kick` | `roomId`, `playerId`, `targetPlayerId` | Host removes another player |
| `room:leave` | `roomId`, `playerId` | Leave the room or mark inactive during play |
| `game:start` | `roomId`, `playerId`, optional `cardsInRound`, `trumpSuit` | Start the first round |
| `game:start_bidding` | `roomId`, `playerId` | Skip pre-bidding countdown |
| `game:bid` | `roomId`, `playerId`, `bid` | Submit a bid |
| `game:play_card` | `roomId`, `playerId`, `cardId` | Play a card |
| `game:toggle_pause` | `roomId`, `playerId` | Pause or resume active play |
| `game:reorder_players` | `roomId`, `playerId`, `orderedPlayerIds` | Host changes lobby order |
| `game:next_round` | `roomId`, `playerId`, optional setup and `action` | Advance, configure, or end a match |
| `game:rematch` | `roomId`, `playerId` | Reset a completed game to the lobby |

### Server-to-client events

| Event | Recipient | Purpose |
|---|---|---|
| `room:state_update` | Every connected room player | Personalized sanitized room snapshot |
| `room:created` | Creating socket | Confirms room creation and player identity |
| `room:joined` | Joining socket | Confirms join or reconnection |
| `room:kicked` | Removed socket | Tells the client to clear its session |
| `game:error` | Requesting socket | Reports rejected action, message, and error code |

The client derives timer displays, trick reveal UI, and round summary UI from `room:state_update`. The server does not currently emit separate `game:turn_timer`, `game:trick_won`, or `game:round_summary` events.

### Error handling

Handlers catch domain errors and emit:

```json
{
  "message": "Human-readable explanation",
  "code": "BID_REJECTED"
}
```

Example error codes include `ROOM_NOT_FOUND`, `SESSION_INVALID`, `SEAT_REJECTED`, `GAME_START_REJECTED`, `BID_REJECTED`, `CARD_REJECTED`, `PAUSE_REJECTED`, and `REMATCH_REJECTED`.

## Host Controls

The room creator receives the host/admin identity when the room is created. Host checks are performed by the server.

| Control | Allowed behavior |
|---|---|
| Start game | Starts only from the lobby with enough seated players |
| Start bidding | Skips the pre-bidding countdown |
| Reorder players | Changes the lobby order before game start |
| Kick player | Removes a player in supported lobby, summary, or game-over phases |
| Configure round | Selects card count and trump suit |
| Pause/resume | Pauses supported active gameplay phases and preserves remaining time |
| Advance round | Starts the next round with optional configuration |
| End game | Sends `action: "end_game"` from the round summary |
| Rematch | Resets a completed game to `LOBBY` |

If the client is modified to show a host button to a non-host, the server rejects the command. UI visibility is convenience, not security.

## Timers and Automatic Actions

The server owns all phase timers:

| Timer | Duration | Expiry behavior |
|---|---:|---|
| Pre-bidding | 30 seconds | Starts bidding |
| Individual bid | 30 seconds | Submits the lowest legal bid |
| Individual card play | 20 seconds | Plays a legal fallback card |
| Trick reveal | 5 seconds | Commits the trick and starts the next trick or summary |
| Round summary | 5 seconds | Begins the next round unless the host ends the game |

Timer data includes an end timestamp. The handler schedules one timeout for the room and verifies that the timestamp is still current before applying the expiry action.

### Pause behavior

When the host pauses supported gameplay:

1. The state engine calculates the remaining milliseconds.
2. It stores that remaining duration.
3. It removes the active `endsAt` value.
4. The room stops progressing.

When resumed:

1. The state engine creates a new `endsAt` from the stored remaining duration.
2. The handler schedules a new room timeout.
3. The clients receive the updated snapshot and redraw the timer.

The server's timestamp checks protect against stale timeout callbacks after pause, resume, manual actions, or phase changes.

## Reconnection and Session Recovery

The recovery path is based on a locally stored player ID.

1. The client stores `roomId`, `playerId`, and `nickname` in `localStorage`.
2. The socket disconnects or the page is refreshed.
3. The client reconnects to Socket.io.
4. `useGameState` sends `room:join` or `room:sync` with the stored identity.
5. The room manager finds the existing player record.
6. The server replaces the old socket ID with the new socket ID.
7. The player keeps their seat, hand, score, and room membership.
8. The server emits a fresh personalized snapshot.

When a socket disconnects during active play, the player remains represented in the room and can be auto-played when their turn expires. An explicit room leave has different behavior: during an active game, the player can be marked inactive; in lobby, summary, or game-over phases, the player can be removed.

The saved player ID is not an identity proof. Anyone who can access the browser storage can present it. The current project is designed for casual private rooms, not authenticated or competitive online play.

## Data Privacy and State Sanitization

Each player receives a personalized state snapshot. The server sanitizes hidden information before emitting it.

The intended visibility rules are:

- A player can see their own hand.
- A player cannot see another player's hand.
- All players can see public table cards, bids, tricks, scores, seats, turn state, and phase state.
- An unseated viewer receives public room state without a private hand.

This must remain server-side. Hiding another hand with CSS or React conditional rendering would not protect it if the raw data had already been sent to the browser.

## Production Deployment

### Local production build

Build the React client:

```bash
npm run build:client
```

Start the server:

```bash
npm run start:server
```

If `client/dist` exists, Express serves the built client and the Socket.io backend from the same origin.

Verify the server:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"ok":true}
```

### Docker

The Dockerfile uses two stages:

1. A Node 20 Alpine builder installs workspace dependencies and runs the Vite client build.
2. A Node 20 Alpine runtime installs production dependencies, copies `client/dist`, copies the server, and exposes port `3001`.

Build and run it:

```bash
docker build -t judgement-online .
docker run --rm -p 3001:3001 judgement-online
```

For a deployed client on another origin, configure CORS explicitly:

```bash
docker run --rm \
  -p 3001:3001 \
  -e CORS_ORIGIN=https://your-client.example.com \
  judgement-online
```

Because room state is in memory, run a single server instance unless a shared Socket.io adapter and shared state store are added. Multiple independent instances would produce separate room maps.

## Development Commands

Run from the repository root:

| Command | Purpose |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run dev:server` | Start the server with Node file watching |
| `npm run dev:client` | Start Vite development server |
| `npm run start:server` | Start the server without file watching |
| `npm run build:client` | Build the production client |
| `npm --workspace client run preview` | Preview the Vite production build |
| `node --check server/src/index.js` | Syntax-check a server file |

The client package also exposes its underlying scripts through the workspace command:

```bash
npm --workspace client run build
npm --workspace client run preview
```

## Troubleshooting

### The browser loads but cannot connect

Check these items:

1. Confirm the server terminal is running.
2. Open `http://localhost:3001/health`.
3. Confirm `VITE_SOCKET_URL` points to the server, not the Vite port.
4. Check that `CORS_ORIGIN` allows the client origin.
5. Restart Vite after changing a `.env` file because Vite reads environment variables at startup.

### The room disappears

Rooms are stored only in process memory. A server restart, container replacement, or crash removes all rooms and active matches.

### A player cannot rejoin

The saved session may be stale or may have been cleared after a kick. Clear the site's local storage, reload the client, and join with a new nickname. A rejoin also fails if the original room no longer exists.

### The client shows an old phase

The browser should replace its local snapshot whenever `room:state_update` arrives. Check the browser console and Socket.io connection status. Refreshing the page should trigger the stored session recovery path.

### Port already in use

Set a different server port and point the client to it:

```bash
set PORT=3010
set VITE_SOCKET_URL=http://127.0.0.1:3010
```

On macOS or Linux:

```bash
PORT=3010 npm run start:server
VITE_SOCKET_URL=http://127.0.0.1:3010 npm run dev:client
```

## Known Limitations

These are current implementation constraints, not intended behavior to infer from the original planning documents:

- Room and game state are not persisted.
- There is no user authentication.
- There is no database or cross-process room store.
- There is no Redis or other Socket.io adapter for horizontal scaling.
- The host identity is not automatically reassigned if the host permanently leaves.
- The server uses complete state snapshots rather than versioned event replay.
- Separate timer, trick-winner, and round-summary socket events are not emitted; clients derive those views from snapshots.
- The design documents use older names such as `DEALING` and `TRICK_RESOLVE`; runtime code currently uses `PRE_BIDDING` and `TRICK_COMPLETE`.
- The design plan mentions room expiry and an explicit per-room lock queue, but the current runtime does not implement those abstractions.
- The current game is designed for casual private rooms and has no anti-cheat or authenticated identity model.

When changing the game engine, update the state machine, the corresponding client phase rendering, the socket handler, and this README together.

## Related Documentation

- [`SETUP.md`](SETUP.md): shorter installation and run guide
- [`implementation_status.md`](implementation_status.md): implementation progress and verification notes
- [`implementation_plan.md`](implementation_plan.md): architecture and product planning history
- [`judgement_online_design.md`](judgement_online_design.md): original design specification

## Verification Checklist

Before opening a pull request, verify:

1. `npm install` completes from a clean checkout.
2. `npm run build:client` completes successfully.
3. The server starts with `npm run start:server`.
4. `GET /health` returns `{ "ok": true }`.
5. Two browser sessions can create and join the same room.
6. At least two seated players can start a round.
7. Bids reject the forbidden final value.
8. Off-suit cards are rejected when the player holds the led suit.
9. A bid timeout and card-play timeout advance the game automatically.
10. A page refresh restores a player's room session when the server is still running.
11. A player cannot see another player's private hand in the network payload.
12. The Docker image builds and serves the client from port `3001`.
