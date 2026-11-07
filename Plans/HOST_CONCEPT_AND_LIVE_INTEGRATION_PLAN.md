ad# Judgement: Host Concept and Live Integration Plan

Date: 2026-11-06

## Current implementation direction

The user's latest instruction supersedes the sample-first gate: all implementation from A1 onward is in the live React build, referring to `design-concept.html` for fonts, toggles, materials, layout and lighting. The main menu must remain unchanged. The HTML files remain visual references.

### Live React progress

| Segment | Status | Implementation |
| --- | --- | --- |
| A1 | Complete in React | Room-scoped `client/src/room-concept.css`, `RoomAtmosphere.jsx`, concept typography, glass and animated trump emblem. Table width/height match the reference across nine viewport widths. |
| A2 | Complete in React | `RoomNavbar.jsx` provides real round/trump/room information, live score toggle, host toggle, exit confirmation and utility dropdown. Host-only navbar start-bidding uses the existing server action, with paused/disconnected/pending guards. |
| A3 | Complete in React | Existing `seats.js` eight-seat rotation retained. Compact avatars/metadata, host/dealer markers, offline/pending status, small opponent fans, responsive hand sizing and full eight-card trick fit. |
| A4 | Complete in React | Phase-aware smoked-glass host management, grouped rosters, internal scrolling, mobile bottom sheet, accessible focus/Escape/outside-dismiss behavior, navbar Host toggle, and scroll locking with restoration. |
| A5 | Complete in React and server | Explicit phase/round context on acknowledged host commands; desired-state pause/resume; no mid-round kicks, match reset or unauthorized admissions; rematch after game over. Pending/disconnected actions cannot be repeated from the panel. |
| A6 | Complete in React and server | Host approvals reserve an available seat without entering the current hand. Eight-seat capacity includes reservations, reconnects preserve them, and named removal confirmation releases seats between rounds. Spectators and approved players survive round cleanup; clockwise dealer rotation survives roster changes. |
| A7 | Complete in React and server | Five-second nonmodal results with immediate pause/manage/start actions. Management freezes exact remaining milliseconds; closing never resumes. Saved setup applies after resumed countdown or immediate start. Invalid setup/insufficient players holds progression. Stale actions and old scheduled timeouts cannot advance another round. |
| A8 | Complete in React and server | Fixed-size scrolling bid chips, selection followed by acknowledged Lock bid, keyboard navigation, forbidden/expired/disconnected/pending states, rejection recovery and accepted-bid receipt. Ordinary/trump ace effects animate the actual played card and table materials from new server-confirmed plays. |
| A9 | Complete, development-only | `client/src/dev/RoomPreview.jsx` reuses the game engine and live components for all seven scenarios, configurable round sizes, ace replay, simulated disconnect and one-shot bid rejection. Vite removes the preview import/tools/fixtures from production; preview makes no Socket.io connection. |
| A10 | Verification complete; ready for user visual review | Fifteen regression tests, production build, real multiplayer host/bid/ace flows, nine viewport widths, keyboard/focus checks, reduced motion/transparency, reset/reconnect cleanup, and production exclusion checks pass. |

Live verification: `npm run build:client` passes. An isolated real Socket.io server and eight players verified seating, navbar actions, pause guards, fresh bidding timer, eight accepted bids and plays, score/host toggles, ordinary-player restrictions and exit back to the main menu. Browser checks passed at 1920, 1440, 1280, 1024, 900, 768, 600, 390 and 320px widths. The 320px full-trick layout was adjusted to keep cards clear of seats. No page JavaScript errors occurred; the main-menu typography remained unchanged after leaving the room. Vite reports its existing React-plugin deprecation warnings.

### A4-A7 verification and implementation notes

- `npm --workspace server test`: eight meaningful state/manager regression tests cover admission, capacity, forbidden actions, millisecond pause/resume, stale context, persisted setup, reconnects, spectator survival, and dealer rotation after removal.
- Real Socket.io + browser verification covers host ownership checks, rejected unapproved self-seating, admission and reconnect without current-hand insertion, management opened during trick reveal, automatic summary hold, focus trapping/restoration, close-without-resume, named offline-player removal, setup validation/save/reopen, resumed automatic deal, full table, mobile scrolling at 390/320px, game-over permissions, rematch and unchanged main menu. No page JavaScript errors.
- Separate real-scheduler verification sends concurrent manual advances and a stale pause, then waits beyond the original five-second deadline: one advance is accepted, stale actions are rejected, and the new round is not advanced by the old timeout.
- Short-screen (390x568) and reduced-motion/reduced-transparency checks verify the host sheet remains within the viewport, its opaque fallback removes blur, and closing restores body scrolling.
- Host requests use Socket.io acknowledgements and six-second bounded waits. They send `expectedRound` and `expectedStatus`; pause requests specify the desired boolean state rather than relying on a toggle.
- `room:admit` is host-authorized. Mid-match `seat:take` is rejected. Approved players have `pendingNextRound: true`, no hand, and no current-round turn until the next deal.
- `game:configure_next_round` saves validated cards/trump only while the summary countdown is paused. The server publishes `nextRoundSetup` so limits and saved values are shared and recover on reconnect/reopen.
- Round cleanup retains waiting/approved room members. The next deal activates only eligible seated players, keeping unapproved spectators inactive. The prior dealer's physical seat is recorded to preserve clockwise rotation after a removal.

The sample-first stages and approval wording below describe the original workflow; this section records the current authorized execution target.

### A8-A10 verification and preview usage

- `npm --workspace server test`: 15 passing tests, covering the host flows plus bid range/zero/forbidden validation, pending/turn/pause/disconnect/expiry guards, accepted-bid receipts, ace classification, batched plays, duplicate snapshots, historical/reconnected plays, no-trump and pause/resume suppression.
- `npm run build:client`: passes. Existing Vite React-plugin deprecation warnings remain.
- Production Socket.io/browser tests confirm that selecting a bid does not submit it, Lock bid accepts zero, forbidden high bids stay disabled, and ordinary/trump ace effects start only after accepted plays. Aces appear as one physical card, effects clean up, and reconnecting into the existing trick does not replay them.
- The full admission/host/round-management browser flow was re-run with confirmed bidding and passed, including removal, saved setup, countdown resume, capacity, mobile host sheet, rematch and unchanged main-menu typography. No page JavaScript errors occurred.
- Development preview tests cover 27 bid choices for a 26-card round, scroll-to-focused keyboard navigation, forbidden-bid skipping, explicit Enter confirmation, duplicate-confirm prevention, server-style rejection/retry, and disconnect/reconnect reset.
- Geometry checks at 1920, 1440, 1280, 1024, 900, 768, 600, 390 and 320px confirm unchanged reference table size, bidding panels clear of the seat ring, no horizontal page overflow, and bid hit areas at least 44px. Small-screen bidding uses a compact layout and phase-specific diagonal-seat offsets instead of enlarging the table.
- Ace presentation uses a queued, bounded visual lifecycle. Pause, disconnect, new trick/round, scenario reset and unmount cancel pending effects. The actual card receives lift/reflection; trump aces also reveal the felt emblem, ripple and dust. None of these effects controls game timing or claims an ordinary ace automatically wins.
- Reduced motion shows static emphasis; reduced transparency provides opaque, blur-free bidding and host panels. Countdown regions do not announce each tick.
- Production-bundle searches found no preview-control marker strings. Opening `?room-preview=bidding` on the production server shows the normal main menu, not a fixture. The development preview generated zero Socket.io requests during the browser checks.

To inspect the scenarios locally:

```text
npm run dev:client
http://localhost:5173/?room-preview=bidding
```

Use the configured development port if it differs from 5173. Supported query values are `pre`, `bidding`, `active`, `summary`, `paused`, `full`, and `over`. The scenario tools sit below the table. They operate on a local instance of the real game engine and cannot modify a multiplayer room. Production users receive only the live room interface.

## 1. Scope and approval boundaries

### Immediate deliverable

Refine `host-concept.html` into a complete, interactive host preview using the approved `design-concept.html` visual language.

This stage covers:
- Eight-seat table.
- Compact player panels.
- Navbar host actions.
- Player admission and removal.
- Bidding and ace-effect previews.
- Round-transition controls.
- Desktop and mobile behavior.

### Later deliverable

Integrate the approved sample into the live React game with server-authoritative actions.

### Fixed constraints

- Do not change the main menu.
- Preserve the approved lighting and table dimensions.
- Use the fonts, glass surfaces, dropdown styling, and controls from `design-concept.html`.
- Keep preview tools separate from actual game controls.
- Production work begins only after the host concept is approved.
- Preserve existing uncommitted work when implementing changes.

## Stage A: Complete the host concept

### HTML sample progress (historical)

| Segment | Status | Evidence |
| --- | --- | --- |
| A1 | Complete | `host-concept.html` uses the approved table frame, aspect ratio, material layers, fonts, glass treatment, dust, and trump-emblem animation. Browser measurements match reference table width, height, and horizontal placement at 1920, 1440, 1280, 1024, 900, 768, 600, 390, and 320px viewport widths. |
| A2 | Complete | One navbar-only Start bidding now action skips the pre-bidding wait and starts a fresh 20-second sample bidding timer. The action disappears during bidding and is disabled while paused. |
| A3 | Complete | Eight viewer-relative seats, 24px desktop / 20px mobile avatars, compact player metadata, host/dealer/turn indicators, long-name truncation, small opponent fans, and a sample local hand. Default scenario includes offline, pending, empty, and connected seats; the full-table scenario fills all eight. |
| A4-A10 | Pending refinement | Existing sample behaviors remain available; these segments require their own implementation and acceptance pass. |
| Original Stage B gate | Superseded | The user authorized live React implementation; current progress is recorded above. |

Verification for A1-A3: browser checks confirm stable table geometry when Host/Scores open, no seat-to-seat or seat-to-card overlap at tested widths, no fan covering another seat or the played cards, no horizontal page overflow, and no page JavaScript errors. Reference geometry checks use identical font fallbacks in both pages to remain independent of external font-network availability. Desktop and mobile screenshots were inspected. The main app and main menu were not edited.

### A1. Shared visual foundation

**Objective:** Make the host sample feel like the same interface as the approved concept.

#### Work

1. Match the concept's layout container, table width, height, proportions, and responsive rules.
2. Preserve emerald felt, refined walnut rail, fine brass detailing, overhead lighting, room shadows, restrained dust motes, and the animated low-contrast trump emblem.
3. Use QuentinCaps for the wordmark, Cormorant Garamond for headings, and DM Sans for controls and information.
4. Match border radii, glass opacity, highlights, button treatments, and dropdown motion.
5. Keep Host and Scores independent of table geometry.

**Acceptance:** At matching viewport sizes, both files produce the same table dimensions. Opening panels does not move or resize the table.

### A2. Navbar and host-only actions

**Objective:** Put the frequently used host action where it is immediately accessible.

Desktop composition:

`Judgement | Trump | Round | Room code | Scores | Start bidding now | Host | Exit`

| Control | Sample behavior |
| --- | --- |
| Trump | Shows the current suit and matches the felt emblem |
| Round | Updates when the next round starts |
| Room code | Displays the example room identity |
| Scores | Opens the compact standings popover |
| Start bidding now | Appears only during the pre-bidding wait |
| Host | Opens management and shows the waiting-player count |
| Exit | Clearly identified as a preview action |

#### Start-bidding behavior

- Place Start bidding now in the navbar.
- Remove duplicate versions from the table center and management panel.
- Clicking skips the remaining pre-bidding wait.
- Bidding opens with a fresh bidding timer.
- The action disappears after the transition.

#### Mobile

Use deliberate rows rather than shrinking every control. Keep the start-bidding action visible when relevant.

**Acceptance:** The navbar remains readable, its phase action is unambiguous, and no duplicate start-bidding button appears.

### A3. Eight-seat layout and compact players

**Objective:** Support a full table without clutter or obstruction.

#### Layout

- Eight fixed seating positions around the perimeter.
- Host/local player at bottom-center.
- Clockwise ordering consistent with the production seating helpers.
- Table center reserved for bidding, played cards, and phase messages.

#### Compact seat design

- Smaller avatars, approximately 24px on desktop and 20px on mobile.
- Tight padding and restrained glass borders.
- Player name as the primary text.
- One secondary line for bid/tricks or connection state.
- Small dealer, host, and active-turn indicators.
- Long names truncate visually, with the full name available accessibly.
- Opponent card fans remain small and outside the central action area.

#### Representative default state

Show the host, several connected players, one offline player, one approved next-round player, one empty seat, and additional arrivals in the waiting list. Provide a separate fully occupied scenario.

**Acceptance:** All eight seats remain distinguishable. No seat panel or opponent fan covers bidding controls, played-card ranks, or the local hand.

### A4. Host management panel

**Objective:** Provide one clear place to manage the table without creating a permanent sidebar.

- Desktop: compact smoked-glass panel anchored near the Host control.
- Mobile: bottom sheet with its own scrollable content.

#### Panel sections

1. Current phase and pause state.
2. Available game controls.
3. At the table.
4. Waiting to join.
5. Joining next round.
6. Next-round setup, when applicable.

#### Opening and closing

- Host toggle opens/closes it.
- Close button, outside click, and Escape dismiss it.
- Opening during the round-summary countdown pauses that countdown.
- Closing does not automatically resume.
- Focus enters the panel, remains inside while open, and returns to the trigger.
- Opening Host closes Scores to avoid stacked competing panels.

**Acceptance:** Panel scrolling does not scroll or resize the table. Its current phase and paused state are always clear.

### A5. Phase-based host permissions

**Objective:** Make available actions match the game phase.

| Phase | Available controls | Restrictions |
| --- | --- | --- |
| Pre-bidding | Navbar start-bidding action; pause/resume in Host | No mid-round removal |
| Bidding | Pause/resume; admission for a future round | No removal or immediate insertion into the current round |
| Card play | Pause/resume; admission for a future round | No removal or current-hand changes |
| Round summary | Pause/resume countdown; manage players; configure/start next round | Changes apply before the next deal |
| Game over | Rematch flow | No active-round actions |

Explain unavailable actions rather than leaving their restrictions ambiguous.

**Acceptance:** Actions cannot be activated through stale buttons after the phase changes.

### A6. Admission, capacity, and removal

#### Waiting players

Each row shows a name, spectating/waiting status, and an Admit next round action.

#### Admission sequence

1. Host approves a waiting player.
2. Sample assigns an available seat.
3. Player moves into Joining next round.
4. Table seat shows Reserved / next round.
5. Player becomes active only when the next deal starts.

Approval during an active hand does not change the current hand or turn order. Reconnecting existing players retain their identity and seat rather than entering the admission queue.

#### Capacity

- Maximum eight occupied or reserved seats.
- Reserved seats count toward capacity.
- Admission is disabled when full.
- Explain that a seat must become available first.
- Recalculate the next-round card limit after roster changes.

#### Removal

- Available between rounds only.
- Cannot remove the host.
- Requires explicit confirmation naming the player.
- After removal, update the seat, roster, capacity, and waiting-player actions.

**Acceptance:** Double clicks do not create duplicate admissions. Removed players release their seats. Pending players receive no current-round cards.

### A7. Five-second round transition

**Objective:** Demonstrate a predictable transition with enough control for player management.

#### Normal sequence

1. Round results appear.
2. Next round in 5s begins.
3. Countdown reaches zero.
4. Approved players become active.
5. New round begins.

#### Management sequence

1. Host presses Pause next round, or opens Host during the countdown.
2. Freeze the remaining time.
3. Host removes an offline player, admits an arrival, or edits next-round setup.
4. Host chooses Resume countdown or Start next round now.

#### Timing rules

- Preserve remaining time in milliseconds internally.
- Round only the displayed seconds.
- Use an absolute deadline while running to avoid timer drift.
- Closing the panel does not resume.
- Prevent simultaneous automatic and manual round advancement.
- Invalid configuration prevents starting and shows an inline explanation.

**Acceptance:** Pausing at any point truly freezes progression. Each round advances once, and only once.

### A8. Bidding and ace previews

**Objective:** Ensure host controls coexist with all approved gameplay visuals.

#### Bidding

- Reuse the approved center-table interface.
- Dynamically generate bid choices from zero through the round's card count.
- Use fixed-size, horizontally scrollable chips.
- Include clear selection and forbidden-bid states.
- Require Lock bid confirmation.
- Show one bidding countdown.
- Show a waiting-player presentation when someone else is bidding.
- Host status does not bypass normal bidding rules.

#### Ace effects

- Ordinary ace entrance.
- Current-trump ace effect.
- Felt emblem reveal, ripple, reflection, and dust treatment.

#### Coordination

- Hide or cancel incompatible effects when changing scenarios.
- Cancel stale timers when resetting the sample.
- Host and Scores remain usable.
- Effects never consume pointer input or change table dimensions.

**Acceptance:** Switching between host management, bidding, card play, and ace previews leaves no stale overlays or timers.

### A9. Scenario controls

Place clearly labeled sample tools below the game interface.

| Scenario | Purpose |
| --- | --- |
| Pre-bidding | Test navbar skip-wait action |
| Bidding | Inspect scrollable chips and host permissions |
| Active round | Verify compact eight-seat play layout |
| Round complete | Test results and five-second transition |
| Management paused | Test removal and admission safely |
| Table full | Verify reserved-seat capacity rules |
| Game over | Inspect rematch presentation |

Each scenario resets its local data and cancels previous effects. Sample controls must not enter production.

### A10. Host-sample verification and approval

#### Visual checks

- Same table dimensions as the approved concept.
- Matching typography and dropdown styling.
- Eight-seat readability.
- No clipping at narrow widths.
- No table movement when opening panels.

#### Interaction checks

- Navbar start-bidding action.
- Host and Scores toggle behavior.
- Pause, close, reopen, resume, and immediate start.
- Admission, full table, confirmed removal.
- Large bidding rounds.
- Ordinary and trump-ace previews.
- Scenario reset and repeated clicks.

#### Accessibility checks

- Keyboard access and focus restoration.
- Readable disabled, selected, and pending states.
- Reduced motion.
- Reduced transparency.
- Meaningful countdown announcements without constant screen-reader chatter.

**Approval gate:** Review and approve the finished host sample before beginning live integration.

## Stage B: Integrate the approved sample into the live game

### B1. React layout and visual components

| File or component | Responsibility |
| --- | --- |
| `client/src/components/GameBoard.jsx` | Navbar, phase actions, panel state |
| `client/src/components/CircularTable.jsx` | Approved materials and eight-seat composition |
| `client/src/components/PlayerSeat.jsx` | Compact player treatment |
| `client/src/components/SeatCardFan.jsx` | Compact opponent hands |
| `client/src/components/AdminRoundControl.jsx` | Phase-aware host management |
| Dedicated score-popover component | Compact live standings |
| `client/src/components/BiddingOverlay.jsx` | Selection, scrollable chips, confirmation, timer |
| `client/src/components/TrickTable.jsx` and dedicated effect component | Accepted-play ace effects |
| `client/src/styles.css` | Shared room styling and responsive rules |

Replace conflicting desktop-sidebar rules rather than adding another layer of competing overrides. Preserve the existing main-menu components and layout.

### B2. Server-authoritative wiring

Reuse existing actions for start bidding, pause/resume, next round, kick, rematch, and leaving the room.

Add the missing host-authorized admission flow. The current `pendingNextRound` mechanism alone does not enforce approval.

Enforce on the server:
- Host-only management.
- Eight-seat capacity, including reservations.
- No current-round insertion.
- Between-round removal.
- Valid next-round configuration.

Use acknowledgements and pending/error states so the UI reflects accepted actions, not optimistic assumptions. Handle duplicate requests and late responses without corrupting local pending state.

Relevant wiring files include `client/src/hooks/useGameState.js`, `server/src/socket/handlers.js`, `server/src/game/roomManager.js`, and `server/src/game/stateEngine.js`.

### B3. Live state and animation integration

- Drive scores, timers, round, trump, players, and bids from real room state.
- Preserve clock-offset correction and pause semantics.
- Handle rejected actions and reconnects.
- Change immediate bid submission to selection followed by confirmation, including keyboard behavior.
- Trigger ace effects from newly accepted plays only.
- Deduplicate repeated snapshots and skip historical plays on reconnect.
- Preserve existing seat rotation, card legality, dealing, dragging, and trick resolution.
- Cancel effects on room/round changes and do not delay server progression.
- Keep ordinary ace effects distinct from actual winner declarations.

### B4. Final verification

Run `npm run build:client` and test real multi-client flows:

- Host versus non-host permissions.
- Arrival, approval, next-round activation.
- Full-table and disconnected-player cases.
- Start bidding, bid expiry, forbidden bids, and confirmation.
- Round countdown, management pause, resume, and immediate start.
- Card play, ace effects, score updates, rematch, and exit.
- Desktop and mobile interaction.
- Reduced-motion and reduced-transparency treatment.
- Main-menu regression check.

Completion gates:
- Production client build passes.
- Tested flows have no browser errors.
- Main menu remains unchanged.
- No sample data, preview switches, fake timers, or demonstration buttons enter the live app.

## Execution order

1. Visual alignment.
2. Eight-seat layout.
3. Navbar.
4. Host panel.
5. Admission/removal.
6. Round transitions.
7. Bidding/effects.
8. Host-sample review and approval.
9. Live wiring.
10. Multiplayer verification.

Design decisions, sample behavior, and production changes remain separate, testable segments. Saving this plan does not authorize skipping the host-sample approval gate.
