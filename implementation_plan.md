# CEO Plan Review: Judgement Online

> **Mode**: SELECTIVE EXPANSION  
> **Chosen Architecture**: Approach A (Minimal Viable Monolith — Node.js + In-Memory Socket.io + React SPA)  
> **Target Goal**: Browser-based multiplayer Judgement card game with zero-friction onboarding, reconnection resilience, and dynamic player scaling.  

---

## 1. Executive Summary & Review Posture

We performed a **CEO Plan Review** (`/plan-ceo-review`) on the Judgement Online project architecture ([judgement_online_design.md](file:///d:/Judgement/judgement_online_design.md)). 

- **Mode**: SELECTIVE EXPANSION — Held the core FSM & rule specifications as baseline while cherry-picking high-delight features.
- **Architectural Decision**: Approach A (Monolithic Express/Node.js + Socket.io Server + React SPA).
- **Key Expansions Accepted**:
  1. **Interactive Bidding Assistant & Forbidden Bid Visual Breakdown** (prevents illegal bids, visual math calculation).
  2. **End-of-Game Awards & 1-Click Rematch** ("Most Accurate Bidder", "Trump Master", "Unluckiest Player").
  3. **Lobby QR Code Overlay** (instant camera scan for mobile player joining).
- **Expansions Deferred / Skipped**:
  - Live Spectator Mode (deferred to keep v1 state engine tight).
  - Web Audio Sound Synthesis & Emoji Reactions (skipped to avoid UI clutter).

---

## 2. System Architecture & Diagrams

### 2.1 Component Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                      React SPA                          │
│ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐ │
│ │  Lobby & QR   │ │   GameBoard   │ │ BiddingAssistant│ │
│ └───────┬───────┘ └───────┬───────┘ └────────┬────────┘ │
│         └─────────────────┼──────────────────┘          │
│                    SocketContext                        │
└───────────────────────────┼─────────────────────────────┘
                            │ WebSockets (Socket.io)
┌───────────────────────────┼─────────────────────────────┐
│                    Node.js Server                       │
│ ┌─────────────────────────▼───────────────────────────┐ │
│ │               Socket Event Handler                  │ │
│ └─────────────────────────┬───────────────────────────┘ │
│ ┌─────────────────────────▼───────────────────────────┐ │
│ │          Per-Room Execution Lock Queue              │ │
│ └─────────────────────────┬───────────────────────────┘ │
│ ┌─────────────────────────▼───────────────────────────┐ │
│ │                RoomManager (Map)                    │ │
│ └──────┬──────────────────┬──────────────────┬────────┘ │
│        │                  │                  │          │
│ ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐   │
│ │ StateEngine │    │ Rules Engine│    │ Turn Timer  │   │
│ └─────────────┘    └─────────────┘    └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Room State Machine (FSM)

```
  [LOBBY] ──(Admin Start)──▶ [DEALING] ──(Cards Dealt)──▶ [BIDDING]
     ▲                                                         │
     │                                                (All Bids In)
  (Rematch)                                                    ▼
     │                                                 [TRICK_PLAYING]
 [GAME_OVER] ◀──(Round 1 Desc Complete)                        │
     ▲                                                (All Played Card)
     │                                                         ▼
 [ROUND_SUMMARY] ◀──(Final Trick Complete)─── [TRICK_RESOLVE]
     │                                                 │
     └──(Next Round)──▶ [DEALING] ◀──(More Tricks)─────┘
```

---

## 3. Data Flow & Shadow Paths Matrix

```
  INPUT ──▶ VALIDATION ──▶ TRANSFORM ──▶ PERSIST ──▶ OUTPUT
    │            │              │            │           │
    ▼            ▼              ▼            ▼           ▼
  [nil?]    [invalid?]    [exception?]  [conflict?]  [stale?]
  [empty?]  [too long?]   [timeout?]    [dup key?]   [partial?]
```

| Flow / Codepath | Happy Path | Nil / Empty Input | Error / Exception Path | Shadow Path Resilience |
|---|---|---|---|---|
| `room:join` | Player attached to room, state returned | Empty nickname defaults to "Player N" | Non-existent roomId emits `game:error` | Player ID UUID stored in `localStorage` reclaims seat cleanly |
| `game:bid` | Bid recorded, turn advances | Nil bid triggers 20s server auto-bid | Forbidden bid returns `ForbiddenBidError` | Server computes `total_tricks - sum(bids)` to reject forbidden bid |
| `game:play_card` | Card played to trick, turn advances | Disconnect/timeout triggers lowest-risk auto-play | Suit violation returns `SuitViolationError` | Server enforces lead suit rule before accepting card |
| `turn_timer` | 20s countdown ticks via `game:turn_timer` | Zero response at 0s triggers auto-action | Race condition with manual click | **Per-Room Lock Queue** serializes action execution |

---

## 4. Failure Modes & Rescue Registry

```
  CODEPATH                  | FAILURE MODE             | RESCUED? | TEST? | USER SEES                      | LOGGED?
  --------------------------|--------------------------|----------|-------|--------------------------------|--------
  room:join                 | Invalid Room Code        | Y        | Y     | "Room not found. Check code."  | Y
  game:bid                  | Forbidden Bid Attempt    | Y        | Y     | "Forbidden bid (sum = tricks)"  | Y
  game:play_card            | Off-suit play when held  | Y        | Y     | "Must follow led suit!"        | Y
  socket disconnect         | Drop during active turn  | Y        | Y     | Yellow "Reconnecting..." badge | Y
  all players disconnect    | Abandoned room           | Y        | Y     | 15-min expiry before purge     | Y
```

> [!IMPORTANT]
> **Zero Critical Gaps**: Every failure mode has a explicit rescue action, client notification, and structured server log.

---

## 5. Scope Decisions & Delta

### 5.1 Accepted Scope (Added to Plan)
- **Node.js + Socket.io Server Engine**: In-memory FSM room manager, per-room turn queue lock, 15-minute abandoned room cleanup.
- **React SPA & SocketContext**: Stateful game table, card hand hover/playable indicators, connection badge, turn timer progress bar.
- **Ascending → Descending Engine**: Automatic max card calculation (`floor(52 / active_players)`) with dynamic phase locking.
- **20-Second Auto-Play Protection**: Server-driven turn fallback for bidding (lowest legal bid) and card play (lowest-risk legal card).
- **Interactive Bidding Assistant**: Real-time math visualizer highlighting forbidden bid.
- **End-of-Game Awards**: Post-game modal with awards ("Most Accurate Bidder", "Trump Master", "Unluckiest Player") & 1-click Rematch.
- **Lobby QR Code**: Canvas QR code overlay for quick mobile camera join.

### 5.2 Deferred / NOT In Scope
- Spectator Mode for mid-round joiners (deferred to TODOS.md).
- Web Audio Sound Synthesis (skipped for initial UI focus).
- Emoji floating reactions (skipped to avoid UI clutter).

---

## 6. Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — `Backend Engine` — Implement RoomManager & FSM State Machine with per-room execution lock
  - Surfaced by: Architecture Review — Race condition on concurrent turns
  - Files: `server/src/game/roomManager.js`, `server/src/game/stateEngine.js`
  - Verify: Run jest integration test with concurrent socket emit
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — `Bidding Engine` — Forbidden Bid Math Validation & Interactive Bidding Assistant
  - Surfaced by: Step 0D Accepted Expansion 1 — Forbidden bid visual breakdown
  - Files: `server/src/game/rules.js`, `client/src/components/BiddingOverlay.jsx`
  - Verify: Test bidding overlay rendering with final bidder constraint
- [ ] **T3 (P1, human: ~1.5h / CC: ~15min)** — `Reconnection Engine` — LocalStorage Persistent Player ID Reconnection & 15-min Room Expiry
  - Surfaced by: Security & Threat Model — Reconnection resilience
  - Files: `server/src/socket/handlers.js`, `client/src/hooks/useGameState.js`
  - Verify: Refresh client browser mid-hand, verify state restoration
- [ ] **T4 (P2, human: ~1h / CC: ~10min)** — `Frontend UI` — End-of-Game Awards & 1-Click Rematch
  - Surfaced by: Step 0D Accepted Expansion 4 — End-of-game awards
  - Files: `client/src/components/GameBoard.jsx`, `client/src/components/ScoreboardModal.jsx`
  - Verify: Trigger game over state, verify awards modal and rematch button
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — `Lobby UI` — Canvas QR Code Overlay for Quick Mobile Room Joining
  - Surfaced by: Step 0D Accepted Expansion 5 — Lobby QR code
  - Files: `client/src/components/Lobby/QRModal.jsx`
  - Verify: Scan QR code on mobile camera, verify room code pre-filled

---

## 7. Verification Plan

### Automated Tests
```bash
# Backend unit & FSM rules tests
npm --prefix server test

# Multi-socket integration tests
npm --prefix server test:integration
```

### Manual Verification
1. Open two browser windows (or desktop + mobile via local network).
2. Create room in window 1, scan QR code / join with room code in window 2.
3. Start game, verify 1-card round dealing and trump rotation (Spades -> Diamonds -> Clubs -> Hearts).
4. Verify bidding restriction on final bidder.
5. Play cards, test off-suit restriction warning when led suit is held.
6. Refresh window 1 mid-hand; confirm instantaneous reconnection without turn loss.
7. Let turn timer hit 0s; confirm 20s auto-play fallback executes cleanly.

---

## GSTACK REVIEW REPORT

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION                         |
| System Audit         | Greenfield Project / Monolithic Stack       |
| Step 0               | Selective Expansion + Monolith Approach A   |
| Section 1  (Arch)    | 2 issues found (In-memory, Turn Concurrency)|
| Section 2  (Errors)  | 7 error paths mapped, 0 GAPS                |
| Section 3  (Security)| 2 issues found (Hand Privacy, Nickname XSS) |
| Section 4  (Data/UX) | 4 edge cases mapped, 0 unhandled            |
| Section 5  (Quality) | 0 issues found                              |
| Section 6  (Tests)   | Diagram produced, 0 gaps                    |
| Section 7  (Perf)    | 0 issues found                              |
| Section 8  (Observ)  | 0 gaps found                                |
| Section 9  (Deploy)  | Single container deploy                     |
| Section 10 (Future)  | Reversibility: 5/5, debt items: 0           |
| Section 11 (Design)  | 0 issues found (React UI Specs)             |
+--------------------------------------------------------------------+
| NOT in scope         | written (3 items)                           |
| What already exists  | written                                     |
| Dream state delta    | written                                     |
| Error/rescue registry| 7 methods, 0 CRITICAL GAPS                  |
| Failure modes        | 5 total, 0 CRITICAL GAPS                    |
| TODOS.md updates     | 3 items proposed                            |
| Scope proposals      | 6 proposed, 3 accepted                      |
| CEO plan             | written to ~/.gstack/projects/Judgement/    |
| Outside voice        | skipped (Codex CLI missing, fallback used)  |
| Diagrams produced    | 3 (Architecture, FSM, Data Flow)            |
| Unresolved decisions | 0                                           |
+====================================================================+
```
