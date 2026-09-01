# Judgement Online UI Issues, Fixes, and Upgrade Ideas

This document records the UI problems identified during the visual review and the gameplay screenshots. It separates confirmed defects from aesthetic direction so future changes do not accidentally trade polish for novelty.

## Product Direction

Judgement should feel like a physical card table with the clarity of a modern game interface. The table, cards, and current decision are the stars. Status chrome, decorative effects, and secondary labels should support that hierarchy instead of competing with it.

## Confirmed Issues and Fixes

### 1. Dragged cards render beneath the table layer

- Severity: High
- Status: Fixed
- Symptom: A card dragged upward from the hand disappears beneath the table or active-player panel.
- Cause: The hand's horizontal scrolling container clipped vertical overflow. The hand also had no stacking priority over the table's transformed stacking context.
- Fix: During drag, the hand receives a higher stacking context and temporarily allows visible overflow.
- Files: `client/src/components/GameBoard.jsx`, `client/src/styles.css`
- Commit: `78f712f`
- Verification: Client production build passes. The fix targets both clipping and stacking causes.

### 2. External fonts block the first render

- Severity: High
- Status: Fixed
- Symptom: The interface can remain visually blank while external font resources load.
- Cause: Google Fonts was loaded as a render-blocking stylesheet.
- Fix: Fonts now preload and promote to a stylesheet asynchronously, with a no-script fallback.
- File: `client/index.html`
- Commit: `e2b171e`
- Verification: Live load measurement improved from approximately 8.6 seconds to 244 milliseconds.

### 3. Gameplay screen has competing focal points

- Severity: High
- Status: Open
- Symptom: The table, active-player panel, timer, player badge, dealer badge, and gold outlines all demand attention at the same time.
- Recommended fix: Define one focal point per phase. During bidding, the current bidder and bid controls should dominate. During trick play, the playable hand and drop target should dominate.

### 4. The timer is duplicated

- Severity: Medium
- Status: Open
- Symptom: The same countdown appears above the active player and again in the bidding panel.
- Recommended fix: Keep one timer inside the decision panel. Use the player's seat only for a small active-turn marker.

### 5. Bidding controls look disabled

- Severity: High
- Status: Open
- Symptom: The `0` and `1` choices are low contrast and visually resemble unavailable actions.
- Recommended fix: Use a clear enabled state with stronger contrast, a visible hover state, a pressed state, and an explicit selected state. The legal choices should be the brightest controls on screen.

### 6. The bidding panel is detached from the active player

- Severity: Medium
- Status: Open
- Symptom: The player labeled as acting is left of center while the bidding panel is centered below the table.
- Recommended fix: Anchor the panel to the active player's seat on desktop, then dock it above the hand on mobile. The user should never need to map the panel to a player manually.

### 7. Room view loses product identity

- Severity: Medium
- Status: Open
- Symptom: Inside a room, the header starts with the room code but no longer clearly identifies Judgement.
- Recommended fix: Keep a compact wordmark or suit mark in the persistent room header. It should be quieter than the room code but always present.

### 8. Mobile room header uses too much vertical space

- Severity: Medium
- Status: Open
- Symptom: At 375px wide, room identity, connection status, phase, menu, and host actions wrap into a large multi-row block.
- Recommended fix: Use two deliberate rows: identity and connection on row one; primary action on row two. Move host controls into a bottom sheet or overflow menu.

### 9. Empty room state has too much inactive canvas

- Severity: Polish
- Status: Open
- Symptom: The table is visually impressive, but the next action is communicated only by a small bottom message.
- Recommended fix: Make the central instruction more prominent and visually connect it to the open seats. For example, animate a subtle path from the message to the nearest available seat.

### 10. Host controls modal is visually heavy

- Severity: Polish
- Status: Open
- Symptom: A small setup task receives a large rounded panel, blur layer, multiple borders, and several highlighted controls.
- Recommended fix: Reduce backdrop intensity, use a flatter panel, and reserve the strongest gold treatment for `Start game`.

## Typography Issues

### 11. Font pairing is distinctive but not consistently comfortable

- Severity: Medium
- Status: Open
- Symptom: QuentinCaps and Cinzel provide personality, but display typography is visually ornate and can become tiring when used near active gameplay information.
- Recommended fix: Keep QuentinCaps for the logo only. Use a calmer display face for game-state headings and a highly legible UI face for timers, scores, labels, and controls.
- Direction: Test a restrained serif or humanist sans pairing. Good candidates include Fraunces, Instrument Serif, Source Serif 4, IBM Plex Sans, Atkinson Hyperlegible, or a custom variable font system.
- Rule: Never use the decorative wordmark font for instructions, timers, button labels, or player status.

### 12. Small uppercase labels create noise

- Severity: Medium
- Status: Open
- Symptom: Labels such as `BIDDING`, `TRUMP`, `ACTING`, and `DEALER` use similar uppercase treatments, making secondary information feel as important as the decision itself.
- Recommended fix: Reserve uppercase lettering for one category of metadata. Use sentence case for status and action labels. Increase readability before adding more decoration.

### 13. Header copy is dense

- Severity: Polish
- Status: Open
- Symptom: `Round 3`, `Ascending 3 cards`, `TRUMP`, `Your turn`, and repeated `Your turn` compete in one horizontal strip.
- Recommended fix: Convert the header into a compact status model: `Round 3`, a single phase label, and a single turn message. Put rules context in a secondary info surface.

## Animation and Effects Issues

### 14. Animations are unclean and over-emphasize state changes

- Severity: High
- Status: Open
- Symptom: Multiple spring transitions, hover lifts, card rotations, pulsing gold rings, shadows, and glow effects can make the interface feel busy rather than physical.
- Recommended fix: Establish a motion budget by phase:
  - Deal: one clear card movement sequence.
  - Turn change: one short seat emphasis.
  - Drag: direct 1:1 movement with a restrained lift.
  - Success: one confirmation transition.
  - Everything else: no animation.

### 15. Excessive glowing effects flatten hierarchy

- Severity: High
- Status: Open
- Symptom: Gold outlines and ambient glows appear on active seats, cards, buttons, and table surfaces. When everything glows, nothing feels selected.
- Recommended fix: Remove ambient glow from static surfaces. Use a crisp 2px outline for focus, a small shadow for lift, and one reserved glow for the current actionable object.
- Visual rule: Gold should mean "act here now," not "this element exists."

### 16. Spring motion can feel ornamental

- Severity: Medium
- Status: Open
- Symptom: Elastic movement and scale changes make cards feel like floating UI tiles instead of physical cards with weight.
- Recommended fix: Use shorter ease-out transitions for UI, a controlled ease-out curve for card movement, and spring motion only for intentional card placement or reveal moments.

### 17. Drag feedback needs a clear drop target

- Severity: Medium
- Status: Partially addressed
- Symptom: The card now remains visible while dragging, but the user still needs a stronger signal for where to release it.
- Recommended fix: Add a quiet table drop zone state: a soft inset outline, a short label such as `Release to play`, and a clear invalid-zone response when the card returns to the hand.

## Layout and Information Architecture

### 18. The hand floats instead of behaving like a control dock

- Severity: Medium
- Status: Open
- Symptom: Hand cards sit in open space at the bottom of the screen, while the decision panel floats above them.
- Recommended fix: Create a stable bottom hand dock with a defined edge, responsive padding, and a clear separation between cards and table controls.

### 19. Player metadata is repeated in too many places

- Severity: Medium
- Status: Open
- Symptom: Names, seat numbers, card counts, turn labels, bid totals, and dealer markers are all shown around the table.
- Recommended fix: Show only information needed for the current phase. During bidding, show bid status. During trick play, show card count and turn. Hide stale or redundant labels.

### 20. Gameplay states need stronger phase-specific composition

- Severity: Medium
- Status: Open
- Symptom: Lobby, bidding, and trick play share much of the same visual structure even though the user's goal changes.
- Recommended fix: Treat each phase as a different composition:
  - Lobby: seats and invitation flow.
  - Bidding: active bidder, timer, and legal bid choices.
  - Trick play: playable cards, drop target, and trick history.
  - Summary: scores, outcome, and next-round action.

## Potential Upgrades

These are product-level improvements, not requirements for the current bug fix.

### A. Introduce a visual state machine

Define a small set of explicit visual modes: `lobby`, `dealing`, `bidding`, `playing`, `trick-complete`, `round-summary`, and `game-over`. Each mode gets its own hierarchy, motion budget, and allowed emphasis. This prevents every component from independently deciding when to glow, pulse, or move.

### B. Replace ambient effects with material cues

Make the table feel physical through texture, shadow direction, card thickness, and contact shadows rather than repeated neon-like glows. The result should still feel premium when all decorative glow is disabled.

### C. Add an interaction grammar

Use consistent signals:

- Gold outline: current actionable element
- Ivory outline: keyboard focus
- Soft lift: hover or selection
- Deep shadow: elevated object
- Red: destructive action only
- No effect: informational content

### D. Add a command surface for advanced players

Support keyboard play, fast bid selection, undo-before-submit where rules allow it, and clear shortcuts displayed only on desktop. Keep the visual interface simple while allowing experienced players to move quickly.

### E. Add spectator mode as a first-class experience

Spectators should see the current phase, player order, last action, and what they are waiting for without being presented with empty interaction affordances. This is especially useful when a room is not yet full.

### F. Improve multiplayer legibility

Add a compact event feed such as `A bid 2`, `You bid 1`, or `C played the 8 of Spades`. This reduces the need to scan every seat and makes the game understandable when several actions happen quickly.

### G. Design for motion reduction by default

Respect reduced-motion preferences, but also offer a user setting with `Calm`, `Standard`, and `Expressive` motion profiles. The calm profile should remove glow pulses, scale jumps, and non-essential card flourishes.

### H. Build a visual regression gallery

Capture each game phase at desktop and mobile sizes with stable fixture data. Compare screenshots after every styling change. This is more useful than checking only whether the app compiles because the main risks are hierarchy, overlap, and motion quality.

### I. Use richer table composition

Consider a felt edge treatment, a subtle dealer marker, physical discard/trick zones, and a dedicated action rail. These upgrades should clarify the game state, not fill empty space with decoration.

### J. Add accessibility as part of the visual language

Make focus rings visually intentional, preserve readable contrast in every state, announce turn changes to assistive technology, and provide non-drag alternatives for every card action. Dragging should be an enhancement, never the only path.

## Recommended Order

1. Fix bidding control contrast and remove the duplicate timer.
2. Establish the typography and motion budgets.
3. Reduce glow and border competition.
4. Anchor the bidding panel to the active player.
5. Rework the mobile header and bottom hand dock.
6. Add phase-specific compositions and event feedback.
7. Add visual regression fixtures for every gameplay state.
