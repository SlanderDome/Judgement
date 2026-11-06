# Judgement Playtest Review & Improvement Backlog

**Review date:** November 4, 2026  
**URL tested:** https://judgement-x0wl.onrender.com/  
**Evidence:** Room VSR635; screenshots captured of desktop lobby, bidding, scoring, mobile portrait/landscape, and tablet portrait.

## Scope and confidence

The review played the opening loop with two active players and one mid-round joiner. Viewports tested by emulation were desktop 1280×720, phone 390×844 portrait, phone 844×390 landscape, and tablet 820×1180 portrait. All players used tabs in one desktop browser. No console errors were observed.

This confirms responsive rendering at those emulated sizes and room synchronization across tabs/viewports, but does **not** establish real-device cross-play. The complete game, real iOS/Android/iPad hardware, and several reconnect/lifecycle paths were not tested. Items below distinguish reproduced findings from hypotheses and proposals.

## Priority 0 — Session identity and reconnect reliability

- [ ] **Prevent same-browser tab session takeover — reproduced twice.** Tabs share `judgement-session` / `judgement-player-id` in localStorage. A second tab can claim the same player identity, replacing the server's socket association; the first tab then showed a frozen lobby while still labeled “Connected.” Use tab-scoped identity that survives reload in that tab, or another robust ownership design. Define how users intentionally reclaim a seat across tabs/devices.
- [ ] **Show truthful connection/synchronization state.** Distinguish transport-connected from room-synced/identity-owned states. Display reconnecting, session conflict, and successful recovery; do not leave stale snapshots labeled connected.
- [ ] **Verify hand persistence across reload — uncertain observation.** A hand appeared different after a round-3 reload, but the original hand may have been misread. Compare server-authoritative hand, seat, score, and phase before/after deliberate reloads.
- [ ] Test reconnect after transient network loss and phone lock/unlock, including when a timer is running.

**Acceptance:** Two tabs in one browser can act as distinct players; same-tab reload resumes the intended player; a stale client is clearly identified; reconnect does not change/deal a player's hand or otherwise mutate authoritative game state.

## Priority 1 — Host controls and room lifecycle

- [ ] **Control mid-round joins — confirmed capability gap.** A room-code holder could join mid-match and take a seat for a later round. Add host-configurable room locking and/or approval for joiners, enforced server-side.
- [ ] **Expose and verify player management.** The playtest did not find kick controls during active play, although project documentation describes kick support in some phases. Confirm server permissions and UI visibility by phase; expose host kick controls where supported and explain restrictions.
- [ ] **Decide host migration behavior — unconfirmed.** Migration was not deliberately tested. Decide whether authority transfers to a remaining connected player or the room remains hostless; implement and communicate the result.
- [ ] **Define abandoned-room cleanup — unverified.** The room kept progressing via automatic actions while everyone was offline. Specify an inactivity timeout and verify active games are not removed unexpectedly.

**Acceptance:** Join policy is enforced by the server; host controls match documented phase permissions; host departure and empty-room behavior are predictable and visible.

## Priority 2 — Rules clarity and gameplay feedback

- [ ] Add a “How to play” / Rules panel accessible from the lobby and in-game. Cover bidding order, forbidden final bid, follow-suit, trump rotation, scoring, round progression, timers, and timeout actions.
- [ ] Explain the forbidden bid inline. The illegal choice was correctly disabled, but its reason was not apparent; identify the value and show the bid-total calculation.
- [ ] Improve the two-step card-play confirmation. Make the confirm action unmistakable or evaluate one-tap play with a short undo window.
- [ ] Strengthen active-player/turn emphasis and make trick winners/results more prominent and readable.
- [ ] Verify and document scoring: current rules document `bid * 10` for a positive exact bid, 10 points for an exact zero bid, and 0 for other outcomes. Test zero bids, busts, and hook-rule edge cases on descending rounds.

## Priority 2 — Responsive layout and accessibility

- [ ] **Tablet portrait:** use available space more effectively; reduce the large gap between table and hand.
- [ ] **Phone landscape:** prevent clipped status content and table overflow; create a compact landscape composition or show a rotate-device hint.
- [ ] Check contrast, touch targets, and safe areas on real hardware. Emulated viewports do not validate physical-device behavior.
- [ ] Verify ad placement on small screens. Ad iframes loaded, but no ad visibly rendered; ensure ads do not overlap the table or hand.

## Full-game and real-device verification gate

- [ ] Play a complete match through end condition, final standings/winner screen, and rematch.
- [ ] Play complete rounds with at least three active players; test exact-zero bids, busts, hook rule, and descending rounds.
- [ ] Deliberately test reconnect/hand persistence, room cleanup, host departure, and mid-round join policy.
- [ ] On real iOS Safari, Android Chrome, and iPad, test touch, safe areas, audio autoplay, phone lock/unlock, and reconnect.
- [ ] Test audio playback and any deal/bid/turn/win effects, mute persistence, and haptics. The review only observed a mute toggle; audio and physical haptics were not tested.

## Later product enhancements (proposals, not confirmed defects)

- [ ] Expand host configuration: timer lengths, scoring variants, round sequence, minimum players, and optional bots.
- [ ] Consider lightweight social features such as chat, emotes, or reactions after reliability and clarity work.

## Suggested delivery order

1. Tab-scoped identity, stale-tab detection, honest connection states, and authoritative reconnect verification.
2. Join policy, player-management controls, host migration decision, and abandoned-room lifecycle.
3. Rules/help, forbidden-bid explanation, and card/turn/trick feedback.
4. Responsive and accessibility improvements, followed by physical-device testing.
5. Full-match verification, then optional configuration and social features.
