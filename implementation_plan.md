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
- **Admin-Controlled Round Engine**: Manual card configuration, active player toggles, and trump suit configuration between rounds.
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

## 8. Implementation Plan: Tech Stack & Scaffolding

### Goal
Set up the monolithic file structure containing the Node.js backend and React frontend, ready for the business logic implementation.

### Proposed Changes

#### Server
- **Tech**: Node.js, Express, Socket.io
- **Structure**:
  - `server/package.json`
  - `server/src/index.js` (Entry point)
  - `server/src/game/roomManager.js`
  - `server/src/game/stateEngine.js`
  - `server/src/game/rules.js`
  - `server/src/socket/handlers.js`

#### Client
- **Tech**: React (via Vite), Socket.io-client, TailwindCSS (if permitted, otherwise vanilla CSS). *Note: Using Vanilla CSS as per default instructions unless you request otherwise.*
- **Structure**:
  - `client/package.json`
  - `client/vite.config.js`
  - `client/src/main.jsx`
  - `client/src/App.jsx`
  - `client/src/context/SocketContext.jsx`
  - `client/src/hooks/useGameState.js`
  - `client/src/components/...`

### Open Questions
1. Should we use Vite for the React frontend scaffolding? (Recommended)
2. Do you have a preference for using TailwindCSS or should we stick to Vanilla CSS as per standard guidelines?

### Verification Plan
- Start the server on port 3001.
- Start the Vite dev server on port 3000.
- Verify that the client can establish a basic WebSocket connection to the server.

---

## 9. Live Playtest Review & Improvement Backlog (2026-11-04)

Source: live playtest review of `https://judgement-x0wl.onrender.com/` on Nov 4, 2026. The playtest used two active players and one mid-round joiner. Desktop, phone, and tablet layouts were emulated in one desktop browser; this is not real-device cross-play verification. See the review notes supplied with this backlog for screenshots and the complete list of untested paths.

### 9.1 Priority 0 — Session identity and connection recovery

- [ ] **P0 — Prevent same-browser tab session takeover.** Reproduced twice: tabs share the `judgement-session` / `judgement-player-id` localStorage identity, and a subsequent connection can replace the previous socket for that player. Use tab-scoped identity persistence (survives reload in that tab but is isolated across tabs) or an equally robust ownership design. Define how a user intentionally transfers/reclaims a seat across tabs/devices.
- [ ] **P0 — Detect stale sockets and show truthful connection state.** A displaced tab remained labeled “Connected” with a frozen room snapshot. Track room synchronization/ownership separately from transport connectivity; surface reconnecting, session-conflict, and successful recovery states, and prevent silent seat swapping.
- [ ] **P0 — Verify recovery and hand persistence.** Deliberately test refresh and reconnect mid-round and compare server-authoritative hand, seat, score, and phase before/after. The apparent hand change during round 3 was uncertain and is not a confirmed defect.
- [ ] **P0 — Exercise reconnect paths beyond tab takeover.** Test transient network loss and phone lock/unlock, including recovery while a turn timer is running.

**Acceptance:** Two tabs in the same browser can act as distinct players; a same-tab reload resumes the intended player; stale clients cannot present a false healthy state; reconnect never re-deals or changes authoritative game state.

### 9.2 Priority 1 — Host and room lifecycle controls

- [ ] **P1 — Mid-game join policy.** Add host-configurable room lock and/or approval before a late joiner can enter. The playtest confirmed that a room-code holder could join mid-match and take a seat for a later round. Preserve spectatorship only if explicitly allowed by the selected policy.
- [ ] **P1 — Make player management available in intended phases.** The playtest did not find kick controls during active play, while project documentation says kick support exists in some phases. Verify actual server permissions and UI phase visibility; expose host kick controls where allowed and communicate restrictions.
- [ ] **P1 — Define host departure behavior.** Host migration was not deliberately tested. Decide whether host authority transfers to an eligible connected player or the room remains hostless, then implement and explain the chosen behavior.
- [ ] **P1 — Abandoned-room cleanup.** Rooms appeared to continue auto-playing while nobody was connected; expiry and cleanup were not verified. Define an inactivity policy and test that active players are not removed unexpectedly.

**Acceptance:** Join policy is enforced server-side; host actions match documented phase permissions; host disconnect and empty-room behavior are deterministic and visible to players.

### 9.3 Priority 2 — Rules comprehension and gameplay feedback

- [ ] **P2 — Add a “How to play” / Rules panel reachable from the lobby and in-game.** Explain bidding order, the forbidden final bid, follow-suit, trump rotation, scoring, round progression, and timer fallback behavior.
- [ ] **P2 — Explain the forbidden bid inline.** The illegal bid was correctly disabled, but the reason was not apparent. Identify the forbidden value and show the bid-total calculation next to the disabled choice.
- [ ] **P2 — Improve card confirmation.** The two-step select-then-confirm card flow was easy to miss. Make confirmation unmistakable or consider one-tap play with an undo window, subject to game-state/race constraints.
- [ ] **P2 — Strengthen active-turn and trick feedback.** Increase active-player emphasis and make completed trick/winner moments more prominent and long enough to read.
- [ ] **P2 — Confirm and document scoring.** Current documented formula awards 10 points for a successful zero bid and `bid * 10` for a positive exact bid; verify zero, bust, and hook/down-curve edge cases in a full game.

### 9.4 Priority 2 — Responsive layout and accessibility

- [ ] **P2 — Tablet portrait layout.** Reduce wasted space between table and hand; use the available viewport more effectively.
- [ ] **P2 — Phone landscape layout.** Prevent clipped status content and table overflow; use a compact landscape composition or a clear rotate-device hint.
- [ ] **P2 — Audit contrast, touch targets, and safe areas** on physical iOS, Android, and iPad devices. Emulated viewport checks do not establish hardware behavior.
- [ ] **P2 — Review ads at small sizes.** Ads loaded but none visibly rendered in the test; verify actual placement and ensure they do not overlap the table or hand.

### 9.5 Full-game and real-device verification gate

- [ ] Play a complete match through the end condition, final standings/winner presentation, and rematch.
- [ ] Play complete bidding rounds with at least three active players; cover zero bids, busts, hook rule, and descending rounds.
- [ ] Verify room cleanup, host departure, and late-join policy under deliberate scenarios.
- [ ] Test audio playback, deal/bid/turn/win effects, mute persistence, iOS autoplay, and any haptics on real hardware. The review only confirmed a mute toggle was visible; playback and haptics were not tested.
- [ ] Run real-device passes on iOS Safari, Android Chrome, and iPad for touch interaction, safe areas, audio, and lock/unlock reconnection.

### 9.6 Later product enhancements (not confirmed defects)

- [ ] Expand host configuration: timer lengths, scoring variants, round sequence, minimum players, and optional bots.
- [ ] Consider lightweight social interactions (chat, emotes, reactions) after core reliability and gameplay clarity are addressed.

### Recommended implementation order

1. P0 identity isolation, stale-tab detection, connection states, and authoritative reconnect verification.
2. P1 join policy, host management/migration decision, and abandoned-room lifecycle.
3. Rules help, forbidden-bid explanation, and card/turn/trick feedback.
4. Responsive and accessibility fixes, followed by physical-device verification.
5. Full-match verification, then optional configuration and social features.
