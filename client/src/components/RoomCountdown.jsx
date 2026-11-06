import { useCountdown } from "../lib/useCountdown.js";

// Only this leaf ticks. Editing a roster or input never re-mounts on timer ticks.
export function RoomCountdown({ timer, paused = false }) {
  const remaining = useCountdown(paused ? null : timer?.endsAt);
  const seconds = Math.max(0, Math.ceil((paused ? timer?.remainingMs ?? 0 : remaining) / 1000));
  return <span className="room-countdown" role="timer" aria-live="off" aria-label={`${paused ? "Paused, " : ""}${seconds} seconds remaining`}>{seconds}s</span>;
}
